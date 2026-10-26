import { z } from 'zod';
import { db } from '@/lib/db';
import { audit, lockOrganization, notify } from './events';
import { invariant } from './errors';
import { has, requirePermission, sameOrg, type Actor } from './policy';
import {
  digest,
  emailSchema,
  hashPassword,
  opaqueToken,
  passwordSchema,
} from './auth';
export async function reviewOrganization(
  actor: Actor,
  id: string,
  approve: boolean,
  reason: string,
) {
  requirePermission(actor, 'organization.review');
  invariant(
    approve || reason.trim().length > 0,
    'A rejection reason is required.',
  );
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, id);
    const org = await tx.organization.findUniqueOrThrow({ where: { id } });
    invariant(
      org.registrationStatus === 'PENDING',
      'This registration has already been reviewed.',
      409,
    );
    await tx.organization.update({
      where: { id },
      data: {
        registrationStatus: approve ? 'APPROVED' : 'REJECTED',
        workspaceActive: approve,
        rejectionReason: approve ? null : reason,
      },
    });
    const applicant = await tx.user.findFirstOrThrow({
      where: { organizationId: id },
      orderBy: { createdAt: 'asc' },
    });
    if (approve) {
      await tx.userRole.create({
        data: { userId: applicant.id, roleId: 'ORG_ADMIN' },
      });
      await audit(tx, actor, applicant.id, 'organization.admin_appointed', {
        organizationId: id,
        reason: 'Registration review and initial administrator appointment',
      });
    }
    await audit(
      tx,
      actor,
      id,
      approve ? 'organization.approved' : 'organization.rejected',
      { reason },
    );
    await notify(
      tx,
      applicant.id,
      approve
        ? 'Organization registration approved'
        : 'Organization registration requires attention',
      '/dashboard',
    );
  });
}
export async function setServiceAuthorization(
  actor: Actor,
  id: string,
  active: boolean,
) {
  requirePermission(actor, 'organization.activate');
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, id);
    const org = await tx.organization.findUniqueOrThrow({ where: { id } });
    invariant(
      org.registrationStatus === 'APPROVED' && org.workspaceActive,
      'Approve registration before activating services.',
    );
    await tx.organization.update({
      where: { id },
      data: {
        serviceAuthorized: active,
        serviceAuthorizationChangedAt: new Date(),
      },
    });
    await audit(tx, actor, id, 'organization.service_authorization', {
      active,
    });
    // Activation explicitly releases approved work; the approval snapshot is retained.
    if (active) {
      const requests = await tx.request.findMany({
        where: {
          organizationId: id,
          intakeStatus: 'APPROVED_WAITING_AUTHORIZATION',
          operationalStatus: null,
        },
      });
      for (const request of requests) {
        const approved = await tx.organizationApproval.findFirst({
          where: { requestId: request.id, decision: 'APPROVED' },
        });
        invariant(
          approved && request.lockedRequirementsSnapshotId,
          'Approval evidence is missing.',
          409,
        );
        await tx.request.update({
          where: { id: request.id },
          data: {
            intakeStatus: 'SUBMITTED',
            operationalStatus: 'SUBMITTED',
            version: { increment: 1 },
          },
        });
        await audit(tx, actor, request.id, 'request.released_after_activation');
        await notify(
          tx,
          request.currentOwnerId,
          'Your approved request has been submitted',
          `/requests/${request.id}`,
        );
      }
    }
  });
}
export async function setOrgAdministrator(
  actor: Actor,
  userId: string,
  appoint: boolean,
) {
  requirePermission(actor, 'organization.appoint_admin');
  await db.$transaction(async (tx) => {
    const initial = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    invariant(initial.organizationId, 'Choose an organization member.');
    await lockOrganization(tx, initial.organizationId);
    const target = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    invariant(
      target.accountType === 'ORGANIZATION' &&
        target.organizationId &&
        target.active,
      'Choose an active organization member.',
    );
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: target.organizationId },
    });
    invariant(org.workspaceActive, 'Organization workspace must be approved.');
    if (appoint)
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: 'ORG_ADMIN' } },
        create: { userId, roleId: 'ORG_ADMIN' },
        update: {},
      });
    else {
      const count = await tx.userRole.count({
        where: {
          roleId: 'ORG_ADMIN',
          user: { organizationId: target.organizationId, active: true },
        },
      });
      const isAdmin = await tx.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: 'ORG_ADMIN' } },
      });
      invariant(
        !isAdmin || count > 1,
        'An active organization must retain at least one active administrator.',
      );
      await tx.userRole.deleteMany({ where: { userId, roleId: 'ORG_ADMIN' } });
    }
    await tx.session.deleteMany({ where: { userId } });
    await audit(
      tx,
      actor,
      userId,
      appoint ? 'organization.admin_appointed' : 'organization.admin_removed',
    );
  });
}
export async function inviteMember(actor: Actor, emailInput: string) {
  requirePermission(actor, 'organization.manage_members');
  invariant(actor.organizationId, 'Organization membership required.', 403);
  const email = emailSchema.parse(emailInput),
    token = opaqueToken();
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, actor.organizationId!);
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: actor.organizationId! },
    });
    invariant(org.workspaceActive, 'Organization workspace is not active.');
    invariant(
      !(await tx.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      })),
      'This email already belongs to an account. Use a separate email for organization membership.',
    );
    await tx.organizationInvitation.updateMany({
      where: {
        organizationId: org.id,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    const invitation = await tx.organizationInvitation.create({
      data: {
        organizationId: org.id,
        email,
        tokenHash: digest(token),
        invitedBy: actor.id,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    await tx.notificationOutbox.create({
      data: {
        recipient: email,
        kind: 'INVITATION',
        payload: { invitationId: invitation.id },
        lastError:
          'Email provider is blocked. Invitation has not been delivered.',
      },
    });
    await audit(tx, actor, invitation.id, 'invitation.created');
  });
  // Only used by service-level tests. HTTP callers must never receive this token.
  return token;
}
export async function acceptInvitation(token: string, input: unknown) {
  const v = z
    .object({
      name: z.string().trim().min(2).max(100),
      password: passwordSchema,
    })
    .parse(input);
  const passwordHash = await hashPassword(v.password);
  await db.$transaction(async (tx) => {
    const initial = await tx.organizationInvitation.findUnique({
      where: { tokenHash: digest(token) },
    });
    invariant(initial, 'Invitation is invalid or expired.');
    await lockOrganization(tx, initial.organizationId);
    const invitation = await tx.organizationInvitation.findUniqueOrThrow({
      where: { id: initial.id },
      include: { organization: true },
    });
    invariant(
      !invitation.acceptedAt &&
        !invitation.revokedAt &&
        invitation.expiresAt > new Date() &&
        invitation.organization.workspaceActive,
      'Invitation is invalid or expired.',
    );
    const user = await tx.user.create({
      data: {
        email: invitation.email,
        name: v.name,
        passwordHash,
        accountType: 'ORGANIZATION',
        organizationId: invitation.organizationId,
        verifiedAt: new Date(),
        roles: { create: { roleId: 'ORG_MEMBER' } },
      },
    });
    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await audit(
      tx,
      { id: user.id, organizationId: user.organizationId },
      invitation.id,
      'invitation.accepted',
    );
  });
}
export async function setMemberActive(
  actor: Actor,
  userId: string,
  active: boolean,
) {
  await db.$transaction(async (tx) => {
    const initial = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    invariant(
      initial.organizationId &&
        (has(actor, 'organization.appoint_admin') ||
          (sameOrg(actor, initial.organizationId) &&
            has(actor, 'organization.manage_members'))),
      'Access denied.',
      403,
    );
    await lockOrganization(tx, initial.organizationId);
    const target = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true },
    });
    invariant(target.organizationId, 'Organization membership required.');
    const admin = target.roles.some((r) => r.roleId === 'ORG_ADMIN');
    if (admin) requirePermission(actor, 'organization.appoint_admin');
    if (!active) {
      invariant(
        target.id !== actor.id,
        'You cannot deactivate your own account.',
      );
      invariant(
        !(await tx.request.count({
          where: {
            currentOwnerId: userId,
            intakeStatus: { not: 'CANCELLED' },
            OR: [
              { operationalStatus: null },
              { operationalStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
            ],
          },
        })),
        'Transfer all active requests before deactivating this member.',
      );
      if (admin)
        invariant(
          (await tx.userRole.count({
            where: {
              roleId: 'ORG_ADMIN',
              user: { organizationId: target.organizationId, active: true },
            },
          })) > 1,
          'The last active organization administrator cannot be deactivated.',
        );
    }
    await tx.user.update({ where: { id: userId }, data: { active } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(
      tx,
      actor,
      userId,
      active ? 'member.activated' : 'member.deactivated',
    );
  });
}
export async function setOrganizationAm(
  actor: Actor,
  id: string,
  targetUserId: string | null,
) {
  requirePermission(actor, 'organization.assign_am');
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, id);
    const org = await tx.organization.findUniqueOrThrow({ where: { id } });
    if (targetUserId)
      invariant(
        await tx.user.findFirst({
          where: {
            id: targetUserId,
            active: true,
            accountType: 'INTERNAL',
            roles: { some: { roleId: 'AM' } },
          },
        }),
        'Choose an active account manager.',
      );
    await tx.organization.update({
      where: { id },
      data: { dedicatedAmId: targetUserId },
    });
    await audit(tx, actor, id, 'organization.am_appointed', {
      from: org.dedicatedAmId,
      to: targetUserId,
    });
    if (targetUserId)
      await notify(
        tx,
        targetUserId,
        'You have been appointed as an organization account manager',
        '/requests',
      );
  });
}
