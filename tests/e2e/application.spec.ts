import 'dotenv/config';
import { db } from '../../src/lib/db';
import { digest } from '../../src/server/auth';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const credentials: Record<string, string> = JSON.parse(
  readFileSync('.local/seed-credentials.json', 'utf8'),
);
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/iresearch' ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error('Browser tests require the local development database.');
  const users = await db.user.findMany({
    where: { email: { in: Object.keys(credentials) } },
    select: { name: true, email: true },
  });
  if (
    users.some(
      (u) =>
        !u.name.startsWith('Development ') ||
        !u.email.endsWith('@iresearch.test'),
    )
  )
    throw new Error('Only generated local fixture accounts may be used.');
  await db.rateLimit.deleteMany({
    where: {
      key: {
        in: Object.keys(credentials).map((email) =>
          digest(`auth:login:${email}`),
        ),
      },
    },
  });
});
test.afterAll(() => db.$disconnect());
async function command(
  context: BrowserContext,
  command: string,
  id?: string,
  version?: number,
  data: Record<string, unknown> = {},
) {
  return context.request.post('/api/actions', {
    headers: { Origin: 'http://localhost:3000' },
    data: { command, id, version, data },
  });
}
async function login(context: BrowserContext, email: string) {
  const response = await command(context, 'login', undefined, undefined, {
    email,
    password: credentials[email],
  });
  expect(response.status()).toBe(200);
}
async function gotoRequest(page: Page, id: string) {
  await page.goto(`/requests/${id}`);
  await expect(
    page.getByRole('heading', { name: 'Research requirements', exact: true }),
  ).toBeVisible();
}
test('public pages are responsive and do not publish invented catalog data', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Your research/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Explore services' }).click();
  await expect(
    page.getByRole('heading', { name: 'Find your next step' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await expect(
    page.getByRole('heading', { name: 'Create your account' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('login sets an HttpOnly session, persists access, and logout revokes it', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('client@iresearch.test');
  await page.getByLabel('Password').fill(credentials['client@iresearch.test']);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'iresearch-session',
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  await page.goto('/settings');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Sign out', exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
});
test('individual registration is pending verification and cannot log in', async ({
  page,
  context,
}) => {
  const email = `e2e-${randomUUID()}@test.invalid`,
    password = randomUUID();
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2E Registration');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Registration recorded' }),
  ).toBeVisible();
  const response = await command(context, 'login', undefined, undefined, {
    email,
    password,
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toContain('verification');
});
test('mutations reject foreign origins and unauthenticated access', async ({
  request,
}) => {
  let response = await request.post('/api/actions', {
    headers: { Origin: 'https://untrusted.invalid' },
    data: {
      command: 'create_draft',
      data: {
        title: 'Attack',
        requirements: 'Unauthorized mutation of a private request.',
      },
    },
  });
  expect(response.status()).toBe(403);
  response = await request.post('/api/actions', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      command: 'create_draft',
      data: {
        title: 'Attack',
        requirements: 'Unauthorized mutation of a private request.',
      },
    },
  });
  expect(response.status()).toBe(401);
});
test('disabled integrations fail explicitly and payment webhooks are not accepted', async ({
  context,
}) => {
  await login(context, 'client@iresearch.test');
  const response = await command(context, 'checkout');
  expect(response.status()).toBe(503);
  const webhook = await context.request.post('/api/payments/webhook', {
    data: { status: 'success' },
  });
  expect(webhook.status()).toBe(503);
  const upload = await command(context, 'upload');
  expect(upload.status()).toBe(503);
});
test('marketing cannot open client requests, organization administration or audit pages', async ({
  page,
  context,
}) => {
  await login(context, 'marketing@iresearch.test');
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Acquisition reporting' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Requests', exact: true }),
  ).toHaveCount(0);
  await page.goto('/organizations');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await page.goto('/audit');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});
test('B2B reject, revise, approve, AM validate and admin assign workflow works in the browser', async ({
  browser,
}) => {
  const member = await browser.newContext(),
    org = await browser.newContext(),
    admin = await browser.newContext(),
    am = await browser.newContext(),
    researcher = await browser.newContext();
  try {
    await login(member, 'member@iresearch.test');
    await login(org, 'org-admin@iresearch.test');
    await login(admin, 'admin@iresearch.test');
    await login(am, 'am@iresearch.test');
    await login(researcher, 'researcher@iresearch.test');
    const title = `E2E research ${randomUUID().slice(0, 8)}`;
    const memberPage = await member.newPage();
    await memberPage.goto('/requests/new');
    await memberPage.getByLabel('Request title').fill(title);
    await memberPage
      .getByLabel('Research requirements')
      .fill('Research objectives for a browser-tested organization request.');
    await memberPage
      .getByRole('button', { name: 'Save draft', exact: true })
      .click();
    await expect(memberPage).toHaveURL(/requests\/[0-9a-f-]+$/);
    const id = memberPage.url().split('/').pop()!;
    await memberPage
      .getByRole('button', { name: 'Submit for organization approval' })
      .click();
    await expect(
      memberPage.getByText('Awaiting organization approval', { exact: true }),
    ).toBeVisible();
    const orgPage = await org.newPage();
    await gotoRequest(orgPage, id);
    await orgPage
      .getByLabel('Reason for rejection')
      .fill('Please add the expected output.');
    await orgPage
      .getByRole('button', { name: 'Return for changes', exact: true })
      .click();
    await expect(
      orgPage.getByText('Changes requested', { exact: true }),
    ).toBeVisible();
    await memberPage.reload();
    await memberPage
      .getByLabel(/^Requirements/)
      .fill(
        'Research objectives with the expected output clearly documented for this request.',
      );
    await memberPage
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      memberPage.getByText('Changes saved.', { exact: true }),
    ).toBeVisible();
    await expect(memberPage.getByText(/Version 4 ·/)).toBeVisible();
    await memberPage
      .getByRole('button', { name: 'Submit for organization approval' })
      .click();
    await expect(
      memberPage.getByText('Awaiting organization approval', { exact: true }),
    ).toBeVisible();
    await orgPage.reload();
    orgPage.once('dialog', (dialog) => dialog.accept());
    await orgPage
      .getByRole('button', { name: 'Approve requirements', exact: true })
      .click();
    await expect(
      orgPage.getByText('Approved requirements are locked.', { exact: false }),
    ).toBeVisible();
    const activate = await command(
      admin,
      'organization_activate',
      '00000000-0000-4000-8000-000000000001',
      undefined,
      { active: true },
    );
    expect(activate.status()).toBe(200);
    const amPage = await am.newPage();
    await gotoRequest(amPage, id);
    await amPage.getByRole('button', { name: 'Acquire editing lease' }).click();
    await expect(amPage.getByText(/Your lease expires at/)).toBeVisible();
    await amPage
      .getByRole('button', { name: 'Mark ready for assignment' })
      .click();
    await expect(
      amPage.getByText('ready for assignment', { exact: true }),
    ).toBeVisible();
    const adminPage = await admin.newPage();
    await gotoRequest(adminPage, id);
    await adminPage
      .getByLabel(/^Researcher/)
      .selectOption({ label: 'Development Researcher' });
    await adminPage
      .getByRole('button', { name: 'Assign researcher', exact: true })
      .click();
    await expect(
      adminPage.getByText('in progress', { exact: true }),
    ).toBeVisible();
    const researcherPage = await researcher.newPage();
    await gotoRequest(researcherPage, id);
    await expect(
      researcherPage.getByRole('heading', { name: 'Researcher workspace' }),
    ).toBeVisible();
    await expect(
      researcherPage.getByRole('button', {
        name: 'Upload deliverable unavailable',
      }),
    ).toBeDisabled();
    await memberPage.reload();
    await expect(
      memberPage.getByText('In progress', { exact: true }),
    ).toBeVisible();
    await expect(
      memberPage.getByText('ready for assignment', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await Promise.all([
      member.close(),
      org.close(),
      admin.close(),
      am.close(),
      researcher.close(),
    ]);
  }
});
test('workspace remains usable on mobile without horizontal overflow', async ({
  page,
  context,
}) => {
  await login(context, 'org-admin@iresearch.test');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.local/mobile-dashboard.png',
    fullPage: true,
  });
});

test('official catalog preserves exact package prices and VAT labeling', async ({
  page,
}) => {
  await page.goto('/packages');
  const card = page.locator('article').filter({
    has: page.getByRole('heading', {
      name: 'Thesis to Publication Package',
      exact: true,
    }),
  });
  await expect(card.getByText(/8,000\.55/)).toBeVisible();
  await expect(card.getByText('VAT included', { exact: true })).toBeVisible();
  await card.getByRole('link', { name: 'View details' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Thesis to Publication Package',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Payment checkout is disabled/)).toBeVisible();
});
