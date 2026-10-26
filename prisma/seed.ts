import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { db } from '../src/lib/db';
import { seedPermissions } from '../scripts/rbac';
import { hashPassword } from '../src/server/auth';
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed is forbidden in production.');
  await seedPermissions();
  await mkdir('.local', { recursive: true });
  const credentials: Record<string, string> = JSON.parse(
    await readFile('.local/seed-credentials.json', 'utf8').catch(() => '{}'),
  );
  const org = await db.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Development organization',
      contactEmail: 'org-admin@iresearch.test',
      registrationStatus: 'APPROVED',
      workspaceActive: true,
    },
    update: {},
  });
  const users = [
    {
      email: 'super-admin@iresearch.test',
      name: 'Development Super Admin',
      role: 'SUPER_ADMIN',
      type: 'INTERNAL',
    },
    {
      email: 'admin@iresearch.test',
      name: 'Development Administrator',
      role: 'ADMIN',
      type: 'INTERNAL',
    },
    {
      email: 'am@iresearch.test',
      name: 'Development Account Manager',
      role: 'AM',
      type: 'INTERNAL',
    },
    {
      email: 'researcher@iresearch.test',
      name: 'Development Researcher',
      role: 'RESEARCHER',
      type: 'INTERNAL',
    },
    {
      email: 'qa@iresearch.test',
      name: 'Development QA Reviewer',
      role: 'QA',
      type: 'INTERNAL',
    },
    {
      email: 'marketing@iresearch.test',
      name: 'Development Marketing',
      role: 'MARKETING',
      type: 'INTERNAL',
    },
    {
      email: 'client@iresearch.test',
      name: 'Development Individual',
      role: 'INDIVIDUAL',
      type: 'INDIVIDUAL',
    },
    {
      email: 'org-admin@iresearch.test',
      name: 'Development Org Admin',
      role: 'ORG_ADMIN',
      type: 'ORGANIZATION',
    },
    {
      email: 'member@iresearch.test',
      name: 'Development Member',
      role: 'ORG_MEMBER',
      type: 'ORGANIZATION',
    },
  ] as const;
  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing) continue;
    const password = randomBytes(24).toString('base64url');
    credentials[u.email] = password;
    await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash: await hashPassword(password),
        accountType: u.type,
        organizationId: u.type === 'ORGANIZATION' ? org.id : null,
        verifiedAt: new Date(),
        roles: { create: { roleId: u.role } },
      },
    });
  }
  await writeFile(
    '.local/seed-credentials.json',
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 },
  );
  console.log(
    'Development identities prepared. Passwords are in ignored .local/seed-credentials.json (mode 0600). No credentials were printed.',
  );
}
main().finally(() => db.$disconnect());
