import { randomBytes, createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { sealData, unsealData } from 'iron-session';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from './events';
import { invariant } from './errors';
import type { Actor } from './policy';
export const sessionCookie =
  process.env.NODE_ENV === 'production'
    ? '__Host-iresearch-session'
    : 'iresearch-session';
export const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128);
export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export const hashPassword = (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export async function rateLimit(key: string, max = 10) {
  const now = new Date();
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" (key,count,"resetsAt") VALUES (${digest(key)},1,${new Date(now.getTime() + 15 * 60_000)}) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateLimit"."resetsAt" < ${now} THEN 1 ELSE "RateLimit".count+1 END, "resetsAt" = CASE WHEN "RateLimit"."resetsAt" < ${now} THEN ${new Date(now.getTime() + 15 * 60_000)} ELSE "RateLimit"."resetsAt" END RETURNING count`;
  invariant(
    rows[0].count <= max,
    'Too many attempts. Please try again in 15 minutes.',
    429,
  );
}
export async function actorForToken(token: string): Promise<Actor | null> {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    include: {
      user: {
        include: {
          organization: true,
          roles: { include: { role: { include: { permissions: true } } } },
        },
      },
    },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    !session.user.active ||
    !session.user.verifiedAt
  )
    return null;
  const u = session.user;
  if (u.organization && !u.organization.workspaceActive) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    accountType: u.accountType,
    organizationId: u.organizationId,
    roles: u.roles.map((r) => r.roleId),
    permissions: [
      ...new Set(
        u.roles.flatMap((r) => r.role.permissions.map((p) => p.permissionId)),
      ),
    ],
  };
}
function cookieSecret() {
  const secret = process.env.SESSION_SECRET;
  invariant(
    secret && secret.length >= 32,
    'SESSION_SECRET must contain at least 32 characters.',
    503,
  );
  return secret;
}
export async function sealSessionToken(token: string) {
  return sealData({ token }, { password: cookieSecret(), ttl: 12 * 60 * 60 });
}
export async function unsealSessionToken(cookie: string) {
  if (!cookie) return '';
  const value = await unsealData<{ token?: string }>(cookie, {
    password: cookieSecret(),
    ttl: 12 * 60 * 60,
  });
  return typeof value.token === 'string' ? value.token : '';
}
export async function currentActor() {
  return actorForToken(
    await unsealSessionToken((await cookies()).get(sessionCookie)?.value ?? ''),
  );
}
let dummyHash: Promise<string> | undefined;
export async function authenticate(email: string, password: string) {
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { organization: true },
  });
  // Verify a dummy Argon2 hash on missing users to avoid a fast account-enumeration branch.
  const valid = user
    ? await verify(user.passwordHash, password).catch(() => false)
    : await verify(
        await (dummyHash ??= hashPassword(opaqueToken())),
        password,
      ).catch(() => false);
  invariant(
    user && valid && user.active,
    'Email or password is incorrect.',
    401,
  );
  invariant(
    user.verifiedAt,
    'Email verification is pending. Email delivery is currently unavailable.',
    403,
  );
  invariant(
    !user.organization || user.organization.workspaceActive,
    'Your organization is awaiting registration review.',
    403,
  );
  const token = opaqueToken();
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 12 * 60 * 60_000),
      },
    });
    await audit(
      tx,
      { id: user.id, organizationId: user.organizationId },
      user.id,
      'auth.login',
    );
  });
  return token;
}
export async function revokeSession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: digest(token) } });
}
const registration = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  accountType: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
  organizationName: z.string().trim().max(160).optional(),
});
export async function register(input: unknown) {
  const v = registration.parse(input);
  invariant(
    v.accountType !== 'ORGANIZATION' || (v.organizationName?.length ?? 0) >= 2,
    'Enter your organization’s legal name.',
  );
  const passwordHash = await hashPassword(v.password);
  await db.$transaction(async (tx) => {
    const org =
      v.accountType === 'ORGANIZATION'
        ? await tx.organization.create({
            data: { name: v.organizationName!, contactEmail: v.email },
          })
        : null;
    const user = await tx.user.create({
      data: {
        name: v.name,
        email: v.email,
        passwordHash,
        accountType: v.accountType,
        organizationId: org?.id,
        roles: {
          create: {
            roleId:
              v.accountType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'ORG_MEMBER',
          },
        },
      },
    });
    await tx.notificationOutbox.create({
      data: {
        recipient: v.email,
        kind: 'VERIFY_EMAIL',
        payload: { userId: user.id },
        lastError: 'Email provider is blocked; verification has not been sent.',
      },
    });
    await audit(
      tx,
      { id: user.id, organizationId: org?.id ?? null },
      org?.id ?? user.id,
      'registration.created',
    );
  });
}
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (user)
    await db.notificationOutbox.create({
      data: {
        recipient: email,
        kind: 'PASSWORD_RESET',
        payload: { userId: user.id },
        lastError: 'Email provider is blocked; reset has not been sent.',
      },
    });
}
export async function redeemAuthToken(
  token: string,
  purpose: 'VERIFY_EMAIL' | 'PASSWORD_RESET',
  password?: string,
) {
  const passwordHash =
    purpose === 'PASSWORD_RESET'
      ? await hashPassword(passwordSchema.parse(password))
      : undefined;
  await db.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: {
        tokenHash: digest(token),
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    invariant(claimed.count === 1, 'This link is invalid or expired.');
    const record = await tx.authToken.findUniqueOrThrow({
      where: { tokenHash: digest(token) },
    });
    await tx.user.update({
      where: { id: record.userId },
      data:
        purpose === 'VERIFY_EMAIL'
          ? { verifiedAt: new Date() }
          : { passwordHash },
    });
    if (purpose === 'PASSWORD_RESET')
      await tx.session.deleteMany({ where: { userId: record.userId } });
    await audit(
      tx,
      { id: record.userId, organizationId: null },
      record.userId,
      `auth.${purpose.toLowerCase()}`,
    );
  });
}
