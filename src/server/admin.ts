import { db } from '@/lib/db';
import { audit } from './events';
import { requirePermission, roleDefinitions, type Actor } from './policy';
import { invariant } from './errors';
export async function setInternalRole(
  actor: Actor,
  userId: string,
  roleId: string,
) {
  requirePermission(actor, 'system.manage');
  invariant(
    ['AM', 'RESEARCHER', 'QA', 'MARKETING', 'ADMIN', 'SUPER_ADMIN'].includes(
      roleId,
    ) && roleDefinitions[roleId],
    'Invalid internal role.',
  );
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273645)`;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true },
    });
    invariant(
      user.accountType === 'INTERNAL' && user.active,
      'Choose an active internal user.',
    );
    if (
      user.roles.some((r) => r.roleId === 'SUPER_ADMIN') &&
      roleId !== 'SUPER_ADMIN'
    )
      invariant(
        (await tx.userRole.count({
          where: { roleId: 'SUPER_ADMIN', user: { active: true } },
        })) > 1,
        'The last super administrator cannot be demoted.',
      );
    if (
      user.roles.some((r) => r.roleId === 'RESEARCHER') &&
      roleId !== 'RESEARCHER'
    )
      invariant(
        !(await tx.request.count({
          where: {
            researcherId: userId,
            operationalStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        })),
        'Reassign active research work before changing this role.',
      );
    if (user.roles.some((r) => r.roleId === 'AM') && roleId !== 'AM')
      invariant(
        !(await tx.organization.count({ where: { dedicatedAmId: userId } })) &&
          !(await tx.request.count({
            where: {
              requestAmId: userId,
              operationalStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
            },
          })),
        'Remove or reassign account manager appointments before changing this role.',
      );
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.create({ data: { userId, roleId } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, actor, userId, 'user.internal_role_changed', { roleId });
  });
}
