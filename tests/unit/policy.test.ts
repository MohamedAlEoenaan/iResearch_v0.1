import { describe, it, expect } from 'vitest';
import {
  canReadRequest,
  clientStatus,
  isOrgAdmin,
  roleDefinitions,
  type Actor,
} from '../../src/server/policy';
const actor = (
  id: string,
  accountType: Actor['accountType'],
  organizationId: string | null,
  role: string,
): Actor => ({
  id,
  name: id,
  email: `${id}@test.invalid`,
  accountType,
  organizationId,
  roles: [role],
  permissions: roleDefinitions[role].permissions,
});
const request = {
  currentOwnerId: 'owner',
  organizationId: 'org-a',
  researcherId: 'researcher',
  operationalStatus: 'IN_PROGRESS' as const,
};
describe('permission boundaries', () => {
  it('allows only same-tenant org administrators to read all requests', () => {
    expect(
      canReadRequest(
        actor('admin', 'ORGANIZATION', 'org-a', 'ORG_ADMIN'),
        request,
      ),
    ).toBe(true);
    expect(
      canReadRequest(
        actor('other', 'ORGANIZATION', 'org-b', 'ORG_ADMIN'),
        request,
      ),
    ).toBe(false);
  });
  it('does not allow grants to cross tenants', () =>
    expect(
      canReadRequest(
        actor('other', 'ORGANIZATION', 'org-b', 'ORG_MEMBER'),
        request,
        true,
      ),
    ).toBe(false));
  it('grants collaborators read-only access within the same tenant', () =>
    expect(
      canReadRequest(
        actor('collab', 'ORGANIZATION', 'org-a', 'ORG_MEMBER'),
        request,
        true,
      ),
    ).toBe(true));
  it('denies marketing and unassigned researchers', () => {
    expect(
      canReadRequest(
        actor('marketing', 'INTERNAL', null, 'MARKETING'),
        request,
      ),
    ).toBe(false);
    expect(
      canReadRequest(actor('other', 'INTERNAL', null, 'RESEARCHER'), request),
    ).toBe(false);
  });
  it('allows only assigned researchers', () =>
    expect(
      canReadRequest(
        actor('researcher', 'INTERNAL', null, 'RESEARCHER'),
        request,
      ),
    ).toBe(true));
  it('QA cannot access unrelated client review requests', () =>
    expect(
      canReadRequest(actor('qa', 'INTERNAL', null, 'QA'), {
        ...request,
        operationalStatus: 'CLIENT_REVIEW',
      }),
    ).toBe(false));
  it('does not grant organization rights to internal accounts with a forged tenant', () =>
    expect(
      isOrgAdmin(actor('fake', 'INTERNAL', 'org-a', 'ORG_ADMIN'), 'org-a'),
    ).toBe(false));
  it('hides assignment and QA states from clients', () => {
    expect(clientStatus('QA_REVIEW', 'SUBMITTED')).toBe('In progress');
    expect(clientStatus('READY_FOR_ASSIGNMENT', 'SUBMITTED')).toBe(
      'Order confirmed',
    );
    expect(clientStatus(null, 'APPROVED_WAITING_AUTHORIZATION')).toContain(
      'awaiting service activation',
    );
  });
  it('keeps researcher, QA, AM and appointment permissions separate', () => {
    expect(roleDefinitions.AM.permissions).not.toContain('request.assign');
    expect(roleDefinitions.QA.permissions).not.toContain('request.research');
    expect(roleDefinitions.ORG_ADMIN.permissions).not.toContain(
      'organization.appoint_admin',
    );
    expect(roleDefinitions.ADMIN.permissions).not.toContain('system.manage');
  });
});
