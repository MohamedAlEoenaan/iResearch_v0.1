import type { Prisma } from '@prisma/client';
import type { Actor } from './policy';
export type Tx = Prisma.TransactionClient;
export async function audit(
  tx: Tx,
  actor: Pick<Actor, 'id' | 'organizationId'> | null,
  entityId: string,
  action: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await tx.auditEvent.create({
    data: {
      actorId: actor?.id,
      organizationId: actor?.organizationId,
      entityId,
      action,
      metadata,
    },
  });
}
export async function notify(
  tx: Tx,
  userId: string,
  title: string,
  href: string,
) {
  await tx.notification.create({ data: { userId, title, href } });
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (user)
    await tx.notificationOutbox.create({
      data: {
        recipient: user.email,
        kind: 'NOTIFICATION',
        payload: { title, href },
        status: 'BLOCKED',
        lastError: 'Email integration disabled by project owner.',
      },
    });
}
export async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`;
}
export async function lockRequest(tx: Tx, requestId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestId}, 1))`;
}
