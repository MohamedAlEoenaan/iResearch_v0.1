import 'dotenv/config';
import { z } from 'zod';
import { db } from '../src/lib/db';
import { emailSchema, passwordSchema, hashPassword } from '../src/server/auth';
import { seedPermissions } from './rbac';
import { DomainError, invariant } from '../src/server/errors';

// One-time operator provisioning for a separate temporary review database.
// Never called by a public endpoint or by the normal application startup.
async function main() {
  invariant(
    process.env.ENABLE_REVIEW_BOOTSTRAP === '1',
    'Review bootstrap is disabled. Explicitly enable it only for a dedicated temporary review database.',
  );
  invariant(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  const email = emailSchema.parse(process.env.REVIEW_ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.REVIEW_ADMIN_PASSWORD);
  await seedPermissions();
  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { roles: { select: { roleId: true } } },
  });
  if (existing) {
    invariant(
      existing.accountType === 'INTERNAL' &&
        existing.active &&
        existing.verifiedAt &&
        existing.roles.some((role) => role.roleId === 'SUPER_ADMIN'),
      'This email already belongs to another account. No account was changed.',
    );
    console.log(
      'Existing active review administrator preserved. Password and roles were not changed.',
    );
    return;
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: 'Temporary Review Administrator',
        passwordHash,
        accountType: 'INTERNAL',
        active: true,
        verifiedAt: new Date(),
        roles: { create: { roleId: 'SUPER_ADMIN' } },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        entityId: user.id,
        action: 'review.administrator_bootstrapped',
        metadata: {
          purpose:
            'Explicit one-time operator provisioning for temporary review; not public email verification.',
        },
      },
    });
  });
  console.log(
    'Temporary review administrator provisioned. Credentials were not printed. Disable ENABLE_REVIEW_BOOTSTRAP and remove REVIEW_ADMIN_PASSWORD from deployment secrets after setup.',
  );
}
main()
  .catch((error) => {
    if (error instanceof z.ZodError)
      console.error(
        'Set a valid REVIEW_ADMIN_EMAIL and a REVIEW_ADMIN_PASSWORD of 12–128 characters in secure secrets.',
      );
    else if (error instanceof DomainError) console.error(error.message);
    else
      console.error(
        'Review bootstrap failed. Check database connectivity and applied migrations; no credentials were logged.',
      );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
