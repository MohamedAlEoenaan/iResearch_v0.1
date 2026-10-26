import { z } from 'zod';
import type { OperationalStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  audit,
  lockOrganization,
  lockRequest,
  notify,
  type Tx,
} from './events';
import { invariant } from './errors';
import {
  canReadRequest,
  has,
  isOrgAdmin,
  requirePermission,
  type Actor,
} from './policy';
import { opaqueToken } from './auth';
const draftSchema = z.object({
  title: z.string().trim().min(3).max(160),
  requirements: z.string().trim().min(20).max(50000),
  serviceId: z.uuid().optional(),
});
export async function requestScope(
  actor: Actor,
): Promise<Prisma.RequestWhereInput> {
  if (actor.accountType === 'INTERNAL') {
    const clauses: Prisma.RequestWhereInput[] = [];
    if (has(actor, 'request.operations_read'))
      clauses.push({ operationalStatus: { not: null } });
    if (has(actor, 'request.research'))
      clauses.push({ researcherId: actor.id });
    if (has(actor, 'request.qa'))
      clauses.push({
        operationalStatus: { in: ['QA_REVIEW', 'READY_FOR_DELIVERY'] },
      });
    return { OR: clauses };
  }
  return {
    OR: [
      { currentOwnerId: actor.id },
      ...(actor.organizationId
        ? [
            has(actor, 'organization.read_all')
              ? { organizationId: actor.organizationId }
              : {
                  organizationId: actor.organizationId,
                  grants: { some: { userId: actor.id, revokedAt: null } },
                },
          ]
        : []),
    ],
  };
}
export async function getRequest(actor: Actor, id: string) {
  const request = await db.request.findFirst({
    where: { id, ...(await requestScope(actor)) },
    include: {
      organization: true,
      service: true,
      approvals: { orderBy: { attempt: 'asc' } },
      snapshots: { orderBy: { version: 'asc' } },
      messages: {
        where: actor.accountType === 'INTERNAL' ? {} : { audience: 'CLIENT' },
        orderBy: { createdAt: 'asc' },
      },
      documents: {
        where:
          actor.accountType === 'INTERNAL'
            ? {}
            : { visibility: 'CLIENT', scanStatus: 'CLEAN' },
        orderBy: { version: 'desc' },
      },
      lock: { select: { holderAmId: true, expiresAt: true } },
      reviews: actor.accountType === 'INTERNAL',
      cancellations: true,
      revisions: true,
    },
  });
  invariant(request, 'Request not found.', 404);
  return request;
}
export async function createDraft(actor: Actor, input: unknown) {
  requirePermission(actor, 'request.create');
  invariant(
    actor.accountType !== 'INTERNAL',
    'Internal accounts cannot create client requests.',
    403,
  );
  const v = draftSchema.parse(input);
  return db.$transaction(async (tx) => {
    if (actor.organizationId) {
      await lockOrganization(tx, actor.organizationId);
      invariant(
        (
          await tx.organization.findUniqueOrThrow({
            where: { id: actor.organizationId },
          })
        ).workspaceActive,
        'Organization workspace is not active.',
      );
    }
    if (v.serviceId)
      invariant(
        await tx.service.findFirst({
          where: { id: v.serviceId, active: true },
        }),
        'Service is unavailable.',
      );
    const request = await tx.request.create({
      data: {
        ...v,
        accountType: actor.accountType,
        organizationId: actor.organizationId,
        createdById: actor.id,
        currentOwnerId: actor.id,
      },
    });
    await audit(tx, actor, request.id, 'request.created');
    return request.id;
  });
}
async function locked(tx: Tx, actor: Actor, id: string, version?: number) {
  const initial = await tx.request.findUnique({ where: { id } });
  invariant(initial, 'Request not found.', 404);
  if (initial.organizationId)
    await lockOrganization(tx, initial.organizationId);
  await lockRequest(tx, id);
  const request = await tx.request.findUniqueOrThrow({ where: { id } });
  const grant = await tx.requestAccessGrant.findFirst({
    where: { requestId: id, userId: actor.id, revokedAt: null },
  });
  invariant(canReadRequest(actor, request, !!grant), 'Request not found.', 404);
  if (version !== undefined)
    invariant(
      request.version === version,
      'This request changed. Refresh before trying again.',
      409,
    );
  return request;
}
export async function editDraft(
  actor: Actor,
  id: string,
  version: number,
  input: unknown,
) {
  const v = draftSchema.omit({ serviceId: true }).parse(input);
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    invariant(
      request.currentOwnerId === actor.id &&
        ['DRAFT', 'DRAFT_FOR_REVISION'].includes(request.intakeStatus),
      'Only the owner may edit an unapproved draft.',
      403,
    );
    invariant(
      !request.lockedRequirementsSnapshotId,
      'Approved requirements cannot be edited.',
    );
    await tx.request.update({
      where: { id },
      data: { ...v, version: { increment: 1 } },
    });
    await audit(tx, actor, id, 'request.draft_updated');
  });
}
export async function submitForApproval(
  actor: Actor,
  id: string,
  version: number,
) {
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    invariant(
      request.accountType === 'ORGANIZATION' &&
        request.currentOwnerId === actor.id &&
        ['DRAFT', 'DRAFT_FOR_REVISION'].includes(request.intakeStatus),
      'Only the owner may submit an organization draft for approval.',
      403,
    );
    const attempt =
      (await tx.organizationApproval.count({ where: { requestId: id } })) + 1;
    await tx.organizationApproval.create({
      data: { requestId: id, attempt, decision: 'PENDING' },
    });
    await tx.request.update({
      where: { id },
      data: { intakeStatus: 'PENDING_APPROVAL', version: { increment: 1 } },
    });
    await audit(tx, actor, id, 'request.approval_requested', { attempt });
    const admins = await tx.user.findMany({
      where: {
        organizationId: request.organizationId,
        active: true,
        roles: { some: { roleId: 'ORG_ADMIN' } },
      },
    });
    for (const admin of admins)
      await notify(
        tx,
        admin.id,
        'A request needs your approval',
        `/requests/${id}`,
      );
  });
}
export async function decideApproval(
  actor: Actor,
  id: string,
  version: number,
  approve: boolean,
  reason: string,
) {
  requirePermission(actor, 'organization.approve_request');
  invariant(
    approve || reason.trim().length > 0,
    'A rejection reason is required.',
  );
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    invariant(
      isOrgAdmin(actor, request.organizationId) &&
        request.intakeStatus === 'PENDING_APPROVAL',
      'This request is not awaiting your organization’s approval.',
      403,
    );
    const attempt = await tx.organizationApproval.findFirstOrThrow({
      where: { requestId: id, decision: 'PENDING' },
      orderBy: { attempt: 'desc' },
    });
    await tx.organizationApproval.update({
      where: { id: attempt.id },
      data: {
        decision: approve ? 'APPROVED' : 'REJECTED',
        reason: reason || null,
        approverId: actor.id,
        decidedAt: new Date(),
      },
    });
    if (approve) {
      const snapshot = await tx.requestRequirementVersion.create({
        data: {
          requestId: id,
          version: request.version,
          payload: {
            title: request.title,
            requirements: request.requirements,
            serviceId: request.serviceId,
          },
          createdById: actor.id,
        },
      });
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: request.organizationId! },
      });
      await tx.request.update({
        where: { id },
        data: {
          lockedRequirementsSnapshotId: snapshot.id,
          intakeStatus: org.serviceAuthorized
            ? 'SUBMITTED'
            : 'APPROVED_WAITING_AUTHORIZATION',
          operationalStatus: org.serviceAuthorized ? 'SUBMITTED' : null,
          version: { increment: 1 },
        },
      });
    } else
      await tx.request.update({
        where: { id },
        data: { intakeStatus: 'DRAFT_FOR_REVISION', version: { increment: 1 } },
      });
    await audit(
      tx,
      actor,
      id,
      approve
        ? 'request.organization_approved'
        : 'request.organization_rejected',
      {
        reason,
        selfApproval: request.currentOwnerId === actor.id,
        attempt: attempt.attempt,
      },
    );
    await notify(
      tx,
      request.currentOwnerId,
      approve ? 'Your request was approved' : 'Your request needs changes',
      `/requests/${id}`,
    );
  });
}
export async function acquireAmLock(
  actor: Actor,
  id: string,
  override = false,
) {
  requirePermission(actor, override ? 'request.lock_override' : 'request.am');
  return db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id);
    invariant(
      request.operationalStatus &&
        !['COMPLETED', 'CANCELLED'].includes(request.operationalStatus),
      'This request is not active.',
    );
    const existing = await tx.requestLock.findUnique({
      where: { requestId: id },
    });
    invariant(
      override ||
        !existing ||
        existing.expiresAt < new Date() ||
        existing.holderAmId === actor.id,
      'Another account manager is editing this request.',
      409,
    );
    if (override) {
      await tx.requestLock.deleteMany({ where: { requestId: id } });
      await audit(tx, actor, id, 'request.lock_overridden', {
        previousHolder: existing?.holderAmId ?? null,
      });
      return null;
    }
    const leaseToken = opaqueToken(),
      expiresAt = new Date(Date.now() + 5 * 60_000);
    await tx.requestLock.upsert({
      where: { requestId: id },
      create: { requestId: id, holderAmId: actor.id, leaseToken, expiresAt },
      update: { holderAmId: actor.id, leaseToken, expiresAt },
    });
    await audit(tx, actor, id, 'request.lock_acquired', {
      expiresAt: expiresAt.toISOString(),
    });
    return { leaseToken, expiresAt };
  });
}
export async function releaseAmLock(actor: Actor, id: string, token: string) {
  requirePermission(actor, 'request.am');
  await db.$transaction(async (tx) => {
    await locked(tx, actor, id);
    const deleted = await tx.requestLock.deleteMany({
      where: { requestId: id, holderAmId: actor.id, leaseToken: token },
    });
    invariant(deleted.count === 1, 'Lock is no longer held by you.', 409);
    await audit(tx, actor, id, 'request.lock_released');
  });
}
async function requireLease(tx: Tx, actor: Actor, id: string, token?: string) {
  requirePermission(actor, 'request.am');
  const lock = await tx.requestLock.findUnique({ where: { requestId: id } });
  invariant(
    lock &&
      lock.holderAmId === actor.id &&
      lock.leaseToken === token &&
      lock.expiresAt > new Date(),
    'Acquire an editing lock before changing this request.',
    409,
  );
}
export type Operation =
  | 'validate'
  | 'request_info'
  | 'respond_info'
  | 'assign'
  | 'researcher_question'
  | 'submit_deliverable'
  | 'qa_approve'
  | 'qa_reject'
  | 'deliver'
  | 'accept'
  | 'revision'
  | 'scope_in'
  | 'scope_out'
  | 'cancel'
  | 'cancel_approve'
  | 'cancel_reject'
  | 'feedback'
  | 'clarification';
export async function operate(
  actor: Actor,
  id: string,
  version: number,
  action: Operation,
  options: { text?: string; targetUserId?: string; leaseToken?: string } = {},
) {
  const text = (options.text ?? '').trim();
  invariant(
    text.length <= 10000,
    'Comments must be at most 10,000 characters.',
  );
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    let next: OperationalStatus | undefined;
    const status = request.operationalStatus;
    const owner = request.currentOwnerId === actor.id;
    const orgAdmin = isOrgAdmin(actor, request.organizationId);
    const needText = () =>
      invariant(text.length > 0, 'Please enter a comment.');
    const am = async () => requireLease(tx, actor, id, options.leaseToken);
    switch (action) {
      case 'validate':
        await am();
        invariant(
          status === 'SUBMITTED',
          'Only submitted requests may be validated.',
        );
        next = 'READY_FOR_ASSIGNMENT';
        break;
      case 'request_info':
        await am();
        needText();
        invariant(
          status && ['SUBMITTED', 'IN_PROGRESS'].includes(status),
          'Information cannot be requested in this state.',
        );
        await tx.request.update({
          where: { id },
          data: { resumeStatus: status },
        });
        next = 'PENDING_CLIENT_INFORMATION';
        break;
      case 'respond_info':
        invariant(
          owner || orgAdmin,
          'Only the owner or an organization administrator may respond.',
          403,
        );
        needText();
        invariant(
          status === 'PENDING_CLIENT_INFORMATION' && request.resumeStatus,
          'No information response is due.',
        );
        next = request.resumeStatus;
        await tx.conversationMessage.updateMany({
          where: { requestId: id, actionRequired: true, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
        break;
      case 'assign': {
        requirePermission(actor, 'request.assign');
        invariant(
          status &&
            [
              'READY_FOR_ASSIGNMENT',
              'IN_PROGRESS',
              'REVISION_REQUIRED',
              'PENDING_CLIENT_INFORMATION',
            ].includes(status),
          'Validate this request before assignment; completed or review-stage work cannot be reassigned.',
        );
        invariant(options.targetUserId, 'Choose an active researcher.');
        const researcher = await tx.user.findFirst({
          where: {
            id: options.targetUserId,
            active: true,
            accountType: 'INTERNAL',
            roles: { some: { roleId: 'RESEARCHER' } },
          },
        });
        invariant(researcher, 'Choose an active researcher.');
        invariant(
          researcher.id !== request.researcherId,
          'Choose a different researcher for reassignment.',
        );
        await tx.request.update({
          where: { id },
          data: { researcherId: researcher.id },
        });
        await tx.requestAssignmentHistory.create({
          data: {
            requestId: id,
            assignmentType: 'RESEARCHER',
            oldUserId: request.researcherId,
            newUserId: researcher.id,
            actorId: actor.id,
          },
        });
        await notify(
          tx,
          researcher.id,
          'A request has been assigned to you',
          `/requests/${id}`,
        );
        next = status === 'READY_FOR_ASSIGNMENT' ? 'IN_PROGRESS' : status;
        break;
      }
      case 'researcher_question':
        requirePermission(actor, 'request.research');
        invariant(
          request.researcherId === actor.id && status === 'IN_PROGRESS',
          'Only the assigned researcher may ask the account manager.',
          403,
        );
        needText();
        break;
      case 'submit_deliverable': {
        requirePermission(actor, 'request.research');
        invariant(
          request.researcherId === actor.id &&
            status &&
            ['IN_PROGRESS', 'REVISION_REQUIRED'].includes(status),
          'This request is not ready for your submission.',
          403,
        );
        const doc = await tx.document.findFirst({
          where: { requestId: id, kind: 'DELIVERABLE', scanStatus: 'CLEAN' },
          orderBy: { version: 'desc' },
        });
        invariant(
          doc &&
            !(await tx.qAReview.findFirst({
              where: { deliverableDocumentId: doc.id },
            })),
          'Upload a new scanned deliverable version before submitting for QA.',
        );
        next = 'QA_REVIEW';
        break;
      }
      case 'qa_approve':
      case 'qa_reject': {
        requirePermission(actor, 'request.qa');
        invariant(status === 'QA_REVIEW', 'This request is not awaiting QA.');
        needText();
        const doc = await tx.document.findFirstOrThrow({
          where: { requestId: id, kind: 'DELIVERABLE', scanStatus: 'CLEAN' },
          orderBy: { version: 'desc' },
        });
        invariant(
          doc.uploadedBy !== actor.id,
          'You cannot review your own deliverable.',
          403,
        );
        await tx.qAReview.create({
          data: {
            requestId: id,
            deliverableDocumentId: doc.id,
            reviewerId: actor.id,
            decision: action === 'qa_approve' ? 'APPROVED' : 'REJECTED',
            comments: text,
          },
        });
        next =
          action === 'qa_approve' ? 'READY_FOR_DELIVERY' : 'REVISION_REQUIRED';
        break;
      }
      case 'deliver': {
        await am();
        invariant(
          status === 'READY_FOR_DELIVERY',
          'QA approval is required before delivery.',
        );
        const doc = await tx.document.findFirstOrThrow({
          where: { requestId: id, kind: 'DELIVERABLE', scanStatus: 'CLEAN' },
          orderBy: { version: 'desc' },
        });
        const review = await tx.qAReview.findFirst({
          where: { deliverableDocumentId: doc.id },
          orderBy: { createdAt: 'desc' },
        });
        invariant(
          review?.decision === 'APPROVED',
          'The latest deliverable must be approved by QA.',
        );
        await tx.document.update({
          where: { id: doc.id },
          data: { visibility: 'CLIENT' },
        });
        next = 'CLIENT_REVIEW';
        break;
      }
      case 'accept':
        invariant(
          owner,
          'Only the current request owner may accept deliverables.',
          403,
        );
        invariant(
          status === 'CLIENT_REVIEW',
          'No deliverable is awaiting acceptance.',
        );
        next = 'COMPLETED';
        break;
      case 'revision':
        invariant(
          owner,
          'Only the current request owner may request revisions.',
          403,
        );
        invariant(
          status === 'CLIENT_REVIEW',
          'No deliverable is awaiting review.',
        );
        needText();
        await tx.clientRevision.create({
          data: { requestId: id, ownerId: actor.id, comments: text },
        });
        next = 'SCOPE_REVIEW';
        break;
      case 'scope_in':
      case 'scope_out': {
        await am();
        invariant(
          status === 'SCOPE_REVIEW',
          'This request is not in scope review.',
        );
        needText();
        const revision = await tx.clientRevision.findFirstOrThrow({
          where: { requestId: id, scopeDecision: null },
          orderBy: { createdAt: 'desc' },
        });
        await tx.clientRevision.update({
          where: { id: revision.id },
          data: {
            scopeDecision:
              action === 'scope_in' ? 'WITHIN_SCOPE' : 'OUT_OF_SCOPE',
            reviewedBy: actor.id,
          },
        });
        if (action === 'scope_in') next = 'IN_PROGRESS';
        break;
      }
      case 'cancel': {
        invariant(
          owner || orgAdmin,
          'Only the owner or an organization administrator may request cancellation.',
          403,
        );
        needText();
        invariant(
          status !== 'COMPLETED' &&
            status !== 'CANCELLED' &&
            request.intakeStatus !== 'CANCELLED',
          'This request is closed.',
        );
        invariant(
          !(await tx.cancellationRequest.findFirst({
            where: { requestId: id, decision: 'PENDING' },
          })),
          'A cancellation request is already pending.',
        );
        await tx.cancellationRequest.create({
          data: {
            requestId: id,
            requestedBy: actor.id,
            reason: text,
            decision: status ? 'PENDING' : 'APPROVED',
            decidedBy: status ? null : actor.id,
          },
        });
        if (!status)
          await tx.request.update({
            where: { id },
            data: { intakeStatus: 'CANCELLED' },
          });
        break;
      }
      case 'cancel_approve':
      case 'cancel_reject': {
        requirePermission(actor, 'request.cancel_decide');
        needText();
        invariant(
          status && !['COMPLETED', 'CANCELLED'].includes(status),
          'This request is closed.',
        );
        const cancellation = await tx.cancellationRequest.findFirst({
          where: { requestId: id, decision: 'PENDING' },
        });
        invariant(cancellation, 'No cancellation request is pending.');
        await tx.cancellationRequest.update({
          where: { id: cancellation.id },
          data: {
            decision: action === 'cancel_approve' ? 'APPROVED' : 'REJECTED',
            decidedBy: actor.id,
          },
        });
        if (action === 'cancel_approve') next = 'CANCELLED';
        break;
      }
      case 'clarification':
        invariant(
          (owner || orgAdmin) &&
            request.lockedRequirementsSnapshotId &&
            status !== 'COMPLETED' &&
            status !== 'CANCELLED',
          'Only the owner or organization administrator may append clarifications to an active approved request.',
          403,
        );
        needText();
        break;
      case 'feedback':
        invariant(
          owner && status === 'COMPLETED',
          'Feedback is available to the owner after completion.',
          403,
        );
        needText();
        await tx.request.update({ where: { id }, data: { feedback: text } });
        break;
      default:
        invariant(false, 'Unknown operation.');
    }
    await tx.request.update({
      where: { id },
      data: {
        ...(next ? { operationalStatus: next } : {}),
        version: { increment: 1 },
      },
    });
    if (text)
      await tx.conversationMessage.create({
        data: {
          requestId: id,
          authorId: actor.id,
          audience: [
            'researcher_question',
            'qa_approve',
            'qa_reject',
            'submit_deliverable',
            'assign',
          ].includes(action)
            ? 'INTERNAL'
            : 'CLIENT',
          type: action,
          text,
          actionRequired: action === 'request_info',
        },
      });
    await audit(tx, actor, id, `request.${action}`, {
      from: status,
      to: next ?? status,
    });
    if (next || ['scope_out', 'cancel_reject'].includes(action))
      await notify(
        tx,
        request.currentOwnerId,
        action === 'scope_out'
          ? 'Revision is outside scope. A separate enquiry is required.'
          : 'Your request has an update',
        `/requests/${id}`,
      );
  });
}
export async function transferOwner(
  actor: Actor,
  id: string,
  version: number,
  targetUserId: string,
) {
  requirePermission(actor, 'organization.transfer');
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    invariant(isOrgAdmin(actor, request.organizationId), 'Access denied.', 403);
    invariant(
      request.operationalStatus !== 'COMPLETED' &&
        request.operationalStatus !== 'CANCELLED' &&
        request.intakeStatus !== 'CANCELLED',
      'Only active requests can be transferred.',
    );
    const target = await tx.user.findFirst({
      where: {
        id: targetUserId,
        organizationId: request.organizationId,
        active: true,
        accountType: 'ORGANIZATION',
      },
    });
    invariant(target, 'Choose an active member of the same organization.');
    await tx.request.update({
      where: { id },
      data: { currentOwnerId: target.id, version: { increment: 1 } },
    });
    await tx.requestAssignmentHistory.create({
      data: {
        requestId: id,
        assignmentType: 'OWNER',
        oldUserId: request.currentOwnerId,
        newUserId: target.id,
        actorId: actor.id,
      },
    });
    await audit(tx, actor, id, 'request.owner_transferred', {
      from: request.currentOwnerId,
      to: target.id,
    });
    await notify(
      tx,
      target.id,
      'A request has been transferred to you',
      `/requests/${id}`,
    );
  });
}
export async function grantAccess(
  actor: Actor,
  id: string,
  targetUserId: string,
  revoke: boolean,
) {
  requirePermission(actor, 'organization.grant_access');
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id);
    invariant(isOrgAdmin(actor, request.organizationId), 'Access denied.', 403);
    invariant(
      await tx.user.findFirst({
        where: {
          id: targetUserId,
          organizationId: request.organizationId,
          active: true,
        },
      }),
      'Choose an active member of this organization.',
    );
    await tx.requestAccessGrant.updateMany({
      where: { requestId: id, userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!revoke)
      await tx.requestAccessGrant.create({
        data: { requestId: id, userId: targetUserId, grantedBy: actor.id },
      });
    await audit(
      tx,
      actor,
      id,
      revoke ? 'request.access_revoked' : 'request.access_granted',
      { targetUserId },
    );
  });
}
export async function setRequestAm(
  actor: Actor,
  id: string,
  version: number,
  targetUserId: string | null,
) {
  requirePermission(actor, 'request.assign_am');
  await db.$transaction(async (tx) => {
    const request = await locked(tx, actor, id, version);
    invariant(
      request.operationalStatus &&
        !['COMPLETED', 'CANCELLED'].includes(request.operationalStatus),
      'Choose an active operational request.',
    );
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
    await tx.request.update({
      where: { id },
      data: { requestAmId: targetUserId, version: { increment: 1 } },
    });
    if (targetUserId)
      await tx.requestAssignmentHistory.create({
        data: {
          requestId: id,
          assignmentType: 'AM',
          oldUserId: request.requestAmId,
          newUserId: targetUserId,
          actorId: actor.id,
        },
      });
    await audit(tx, actor, id, 'request.am_appointed', {
      from: request.requestAmId,
      to: targetUserId,
    });
    if (targetUserId)
      await notify(
        tx,
        targetUserId,
        'You have been appointed as a request account manager',
        `/requests/${id}`,
      );
  });
}
