import type { AccountType, Request } from '@prisma/client';
import { invariant } from './errors';
export type Actor = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  organizationId: string | null;
  permissions: string[];
  roles: string[];
};
export const roleDefinitions: Record<
  string,
  { label: string; permissions: string[] }
> = {
  INDIVIDUAL: {
    label: 'Individual client',
    permissions: ['request.create', 'request.own'],
  },
  ORG_MEMBER: {
    label: 'Organization member',
    permissions: ['request.create', 'request.own'],
  },
  ORG_ADMIN: {
    label: 'Organization administrator',
    permissions: [
      'request.create',
      'request.own',
      'organization.manage_members',
      'organization.approve_request',
      'organization.read_all',
      'organization.transfer',
      'organization.grant_access',
    ],
  },
  AM: {
    label: 'Account manager',
    permissions: ['request.operations_read', 'request.am'],
  },
  RESEARCHER: { label: 'Researcher', permissions: ['request.research'] },
  QA: { label: 'Quality assurance', permissions: ['request.qa'] },
  MARKETING: { label: 'Marketing', permissions: ['marketing.read'] },
  ADMIN: {
    label: 'iResearch administrator',
    permissions: [
      'organization.review',
      'organization.activate',
      'organization.assign_am',
      'organization.appoint_admin',
      'request.operations_read',
      'request.assign',
      'request.assign_am',
      'request.cancel_decide',
      'request.lock_override',
      'catalog.manage',
      'users.manage',
      'audit.read',
    ],
  },
  SUPER_ADMIN: {
    label: 'Super administrator',
    permissions: [
      'organization.review',
      'organization.activate',
      'organization.assign_am',
      'organization.appoint_admin',
      'request.operations_read',
      'request.assign',
      'request.assign_am',
      'request.cancel_decide',
      'request.lock_override',
      'catalog.manage',
      'users.manage',
      'audit.read',
      'system.manage',
    ],
  },
};
export const has = (actor: Actor, permission: string) =>
  actor.permissions.includes(permission);
export function requirePermission(actor: Actor, permission: string) {
  invariant(
    has(actor, permission),
    'You do not have permission to perform this action.',
    403,
  );
}
export function sameOrg(actor: Actor, organizationId: string | null) {
  return (
    actor.accountType === 'ORGANIZATION' &&
    !!organizationId &&
    actor.organizationId === organizationId
  );
}
export function isOrgAdmin(actor: Actor, organizationId: string | null) {
  return sameOrg(actor, organizationId) && has(actor, 'organization.read_all');
}
export function canReadRequest(
  actor: Actor,
  request: Pick<
    Request,
    'currentOwnerId' | 'organizationId' | 'researcherId' | 'operationalStatus'
  >,
  granted = false,
) {
  if (actor.accountType !== 'INTERNAL')
    return (
      actor.id === request.currentOwnerId ||
      isOrgAdmin(actor, request.organizationId) ||
      (sameOrg(actor, request.organizationId) && granted)
    );
  return (
    (has(actor, 'request.operations_read') && !!request.operationalStatus) ||
    (has(actor, 'request.research') && request.researcherId === actor.id) ||
    (has(actor, 'request.qa') &&
      !!request.operationalStatus &&
      ['QA_REVIEW', 'READY_FOR_DELIVERY'].includes(request.operationalStatus))
  );
}
export function clientStatus(status: string | null, intake: string) {
  if (!status)
    return (
      (
        {
          DRAFT: 'Draft',
          PENDING_APPROVAL: 'Awaiting organization approval',
          DRAFT_FOR_REVISION: 'Changes requested',
          APPROVED_WAITING_AUTHORIZATION:
            'Approved · awaiting service activation',
          CANCELLED: 'Cancelled',
        } as Record<string, string>
      )[intake] ?? intake
    );
  return (
    (
      {
        SUBMITTED: 'Order confirmed',
        READY_FOR_ASSIGNMENT: 'Order confirmed',
        IN_PROGRESS: 'In progress',
        QA_REVIEW: 'In progress',
        REVISION_REQUIRED: 'In progress',
        READY_FOR_DELIVERY: 'In progress',
        PENDING_CLIENT_INFORMATION: 'Action required',
        CLIENT_REVIEW: 'Ready for review',
        SCOPE_REVIEW: 'Revision under review',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
      } as Record<string, string>
    )[status] ?? status
  );
}
