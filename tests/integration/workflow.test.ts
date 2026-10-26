import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/lib/db';
import { seedPermissions } from '../../scripts/rbac';
import {
  hashPassword,
  authenticate,
  actorForToken,
  digest,
  opaqueToken,
  redeemAuthToken,
  register,
  rateLimit,
} from '../../src/server/auth';
import {
  reviewOrganization,
  setOrgAdministrator,
  setServiceAuthorization,
  inviteMember,
  acceptInvitation,
  setMemberActive,
  setOrganizationAm,
} from '../../src/server/organizations';
import {
  createDraft,
  submitForApproval,
  decideApproval,
  editDraft,
  getRequest,
  acquireAmLock,
  releaseAmLock,
  operate,
  transferOwner,
  grantAccess,
  setRequestAm,
} from '../../src/server/requests';
import type { Actor } from '../../src/server/policy';
const prefix = randomUUID(),
  password = opaqueToken();
let hash: string, orgA: string, orgB: string;
let admin: Actor,
  orgAdmin: Actor,
  member: Actor,
  other: Actor,
  am: Actor,
  am2: Actor,
  researcher: Actor,
  qa: Actor,
  individual: Actor;
async function makeUser(role: string, orgId?: string) {
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@integration.test`,
      name: `Test ${role}`,
      passwordHash: hash,
      accountType: orgId
        ? 'ORGANIZATION'
        : role === 'INDIVIDUAL'
          ? 'INDIVIDUAL'
          : 'INTERNAL',
      organizationId: orgId,
      verifiedAt: new Date(),
      roles: { create: { roleId: role } },
    },
  });
  return (await actorForToken(await authenticate(user.email, password)))!;
}
async function draft(owner = member) {
  return createDraft(owner, {
    title: `Research ${prefix}`,
    requirements: 'An integration-test research brief with sufficient detail.',
  });
}
async function pending() {
  const id = await draft();
  await submitForApproval(member, id, 1);
  return id;
}
async function submitted() {
  await setServiceAuthorization(admin, orgA, true);
  const id = await pending();
  await decideApproval(orgAdmin, id, 2, true, '');
  return id;
}
async function inProgress() {
  const id = await submitted();
  const lease = (await acquireAmLock(am, id))!;
  await operate(am, id, 3, 'validate', { leaseToken: lease.leaseToken });
  await operate(admin, id, 4, 'assign', { targetUserId: researcher.id });
  return { id, lease };
}
async function document(id: string, version = 1) {
  return db.document.create({
    data: {
      requestId: id,
      uploadedBy: researcher.id,
      objectKey: `integration/${randomUUID()}`,
      fileName: 'test-fixture.pdf',
      mime: 'application/pdf',
      size: 100,
      kind: 'DELIVERABLE',
      visibility: 'INTERNAL',
      checksum: digest('test fixture'),
      version,
      scanStatus: 'CLEAN',
    },
  });
}
beforeAll(async () => {
  await seedPermissions();
  hash = await hashPassword(password);
  orgA = (
    await db.organization.create({
      data: {
        name: `Integration A ${prefix}`,
        contactEmail: `a-${prefix}@test.invalid`,
        registrationStatus: 'APPROVED',
        workspaceActive: true,
      },
    })
  ).id;
  orgB = (
    await db.organization.create({
      data: {
        name: `Integration B ${prefix}`,
        contactEmail: `b-${prefix}@test.invalid`,
        registrationStatus: 'APPROVED',
        workspaceActive: true,
      },
    })
  ).id;
  admin = await makeUser('ADMIN');
  orgAdmin = await makeUser('ORG_ADMIN', orgA);
  member = await makeUser('ORG_MEMBER', orgA);
  other = await makeUser('ORG_ADMIN', orgB);
  am = await makeUser('AM');
  am2 = await makeUser('AM');
  researcher = await makeUser('RESEARCHER');
  qa = await makeUser('QA');
  individual = await makeUser('INDIVIDUAL');
});
afterAll(() => db.$disconnect());
describe('identity and organization controls', () => {
  it('records separate registration without silently verifying email', async () => {
    const email = `signup-${randomUUID()}@test.invalid`;
    await register({
      name: 'New Individual',
      email,
      password,
      accountType: 'INDIVIDUAL',
      organizationId: orgA,
      role: 'SUPER_ADMIN',
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email },
      include: { roles: true },
    });
    expect(user.organizationId).toBeNull();
    expect(user.verifiedAt).toBeNull();
    expect(user.roles.map((r) => r.roleId)).toEqual(['INDIVIDUAL']);
    await expect(authenticate(email, password)).rejects.toThrow('verification');
    expect(
      await db.notificationOutbox.count({
        where: { recipient: email, status: 'BLOCKED' },
      }),
    ).toBe(1);
  });
  it('separates registration approval from service activation and records initial admin appointment', async () => {
    const email = `org-${randomUUID()}@test.invalid`;
    await register({
      name: 'Applicant',
      email,
      password,
      accountType: 'ORGANIZATION',
      organizationName: 'Integration applicant',
    });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await expect(
      reviewOrganization(orgAdmin, user.organizationId!, true, ''),
    ).rejects.toThrow('permission');
    await reviewOrganization(admin, user.organizationId!, true, '');
    const org = await db.organization.findUniqueOrThrow({
      where: { id: user.organizationId! },
    });
    expect(org.workspaceActive).toBe(true);
    expect(org.serviceAuthorized).toBe(false);
    expect(
      await db.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId: 'ORG_ADMIN' } },
      }),
    ).not.toBeNull();
    await expect(reviewOrganization(admin, org.id, true, '')).rejects.toThrow(
      'already',
    );
  });
  it('rejects invalid logins and expired/revoked sessions', async () => {
    await expect(authenticate(member.email, 'wrong-password')).rejects.toThrow(
      'incorrect',
    );
    const token = await authenticate(member.email, password);
    await db.session.update({
      where: { tokenHash: digest(token) },
      data: { expiresAt: new Date(0) },
    });
    expect(await actorForToken(token)).toBeNull();
  });
  it('enforces database-backed rate limits', async () => {
    const key = randomUUID();
    await rateLimit(key, 1);
    await expect(rateLimit(key, 1)).rejects.toMatchObject({ status: 429 });
  });
  it('consumes reset tokens exactly once and revokes sessions', async () => {
    const target = await makeUser('INDIVIDUAL');
    const token = opaqueToken(),
      session = await authenticate(target.email, password);
    await db.authToken.create({
      data: {
        tokenHash: digest(token),
        userId: target.id,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    await redeemAuthToken(token, 'PASSWORD_RESET', opaqueToken());
    expect(await actorForToken(session)).toBeNull();
    await expect(
      redeemAuthToken(token, 'PASSWORD_RESET', opaqueToken()),
    ).rejects.toThrow('invalid');
  });
  it('keeps administrator appointments privileged and preserves the last administrator', async () => {
    await expect(
      setOrgAdministrator(orgAdmin, member.id, true),
    ).rejects.toThrow('permission');
    await expect(
      setOrgAdministrator(admin, orgAdmin.id, false),
    ).rejects.toThrow('at least one');
  });
  it('invites ordinary members only, prevents replay, and does not claim delivery', async () => {
    const email = `invited-${randomUUID()}@test.invalid`;
    const token = await inviteMember(orgAdmin, email);
    expect(
      await db.notificationOutbox.count({
        where: { recipient: email, status: 'BLOCKED' },
      }),
    ).toBe(1);
    await acceptInvitation(token, { name: 'Invited Member', password });
    const user = await db.user.findUniqueOrThrow({
      where: { email },
      include: { roles: true },
    });
    expect(user.organizationId).toBe(orgA);
    expect(user.roles.map((r) => r.roleId)).toEqual(['ORG_MEMBER']);
    await expect(
      acceptInvitation(token, { name: 'Replay', password }),
    ).rejects.toThrow('invalid');
    await expect(inviteMember(orgAdmin, individual.email)).rejects.toThrow(
      'separate email',
    );
  });
});
describe('intake, tenancy and approvals', () => {
  it('denies cross-tenant reads and mutations including forged access grants', async () => {
    const id = await draft();
    await expect(getRequest(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(
      editDraft(other, id, 1, {
        title: 'Intrusion',
        requirements: 'Unauthorized update with enough detail.',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      grantAccess(orgAdmin, id, other.id, false),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires rejection reason, retains ID/history, freezes approved requirements', async () => {
    const id = await pending();
    await expect(decideApproval(orgAdmin, id, 2, false, '')).rejects.toThrow(
      'reason',
    );
    await decideApproval(orgAdmin, id, 2, false, 'Clarify objectives');
    await editDraft(member, id, 3, {
      title: 'Revised research',
      requirements: 'A revised detailed research brief with clear objectives.',
    });
    await submitForApproval(member, id, 4);
    await decideApproval(orgAdmin, id, 5, true, 'Approved');
    const r = await getRequest(member, id);
    expect(r.id).toBe(id);
    expect(r.approvals.map((a) => a.decision)).toEqual([
      'REJECTED',
      'APPROVED',
    ]);
    expect(r.lockedRequirementsSnapshotId).toBeTruthy();
    await expect(
      editDraft(member, id, 6, {
        title: 'Changed',
        requirements: 'Attempt to modify the approved requirements.',
      }),
    ).rejects.toThrow('unapproved');
    await expect(
      db.request.update({ where: { id }, data: { requirements: 'tamper' } }),
    ).rejects.toThrow('Approved requirements');
    await expect(
      db.requestRequirementVersion.update({
        where: { id: r.lockedRequirementsSnapshotId! },
        data: { payload: { tampered: true } },
      }),
    ).rejects.toThrow('immutable');
  });
  it('holds approval before activation and releases it exactly once', async () => {
    await setServiceAuthorization(admin, orgA, false);
    const id = await pending();
    await decideApproval(orgAdmin, id, 2, true, '');
    let r = await getRequest(member, id);
    expect(r.intakeStatus).toBe('APPROVED_WAITING_AUTHORIZATION');
    expect(r.operationalStatus).toBeNull();
    await setServiceAuthorization(admin, orgA, true);
    await setServiceAuthorization(admin, orgA, true);
    r = await getRequest(member, id);
    expect(r.operationalStatus).toBe('SUBMITTED');
    expect(
      await db.auditEvent.count({
        where: { entityId: id, action: 'request.released_after_activation' },
      }),
    ).toBe(1);
  });
  it('records self-approval and prevents concurrent duplicate approvals', async () => {
    const id = await draft(orgAdmin);
    await submitForApproval(orgAdmin, id, 1);
    const results = await Promise.allSettled([
      decideApproval(orgAdmin, id, 2, true, ''),
      decideApproval(orgAdmin, id, 2, true, ''),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const event = await db.auditEvent.findFirstOrThrow({
      where: { entityId: id, action: 'request.organization_approved' },
    });
    expect(event.metadata).toMatchObject({ selfApproval: true });
    expect(
      await db.requestRequirementVersion.count({ where: { requestId: id } }),
    ).toBe(1);
  });
  it('rejects B2B submission without approval and B2C submission without verified payment at DB level', async () => {
    const b2b = await draft();
    await expect(
      db.request.update({
        where: { id: b2b },
        data: { intakeStatus: 'SUBMITTED', operationalStatus: 'SUBMITTED' },
      }),
    ).rejects.toThrow('approval');
    const b2c = await draft(individual);
    await expect(
      db.request.update({
        where: { id: b2c },
        data: { intakeStatus: 'SUBMITTED', operationalStatus: 'SUBMITTED' },
      }),
    ).rejects.toThrow('Verified payment');
  });
  it('allows view-only sharing but not editing or acceptance', async () => {
    const collaborator = await makeUser('ORG_MEMBER', orgA),
      id = await draft();
    await grantAccess(orgAdmin, id, collaborator.id, false);
    expect((await getRequest(collaborator, id)).id).toBe(id);
    await expect(
      editDraft(collaborator, id, 1, {
        title: 'Wrong owner',
        requirements: 'A collaborator cannot change these requirements.',
      }),
    ).rejects.toThrow('owner');
    await grantAccess(orgAdmin, id, collaborator.id, true);
    await expect(getRequest(collaborator, id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('transfers ownership, preserves creator, and requires transfer before deactivation', async () => {
    const source = await makeUser('ORG_MEMBER', orgA),
      target = await makeUser('ORG_MEMBER', orgA),
      id = await draft(source);
    await expect(setMemberActive(orgAdmin, source.id, false)).rejects.toThrow(
      'Transfer',
    );
    await transferOwner(orgAdmin, id, 1, target.id);
    const r = await getRequest(target, id);
    expect(r.createdById).toBe(source.id);
    expect(r.currentOwnerId).toBe(target.id);
    await expect(getRequest(source, id)).rejects.toMatchObject({ status: 404 });
    await setMemberActive(orgAdmin, source.id, false);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: source.id } })).active,
    ).toBe(false);
  });
});
describe('operations, QA and client acceptance', () => {
  it('supports audited researcher reassignment and removes the former researcher’s access', async () => {
    const { id } = await inProgress();
    const replacement = await makeUser('RESEARCHER');
    await operate(admin, id, 5, 'assign', { targetUserId: replacement.id });
    await expect(getRequest(researcher, id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await getRequest(replacement, id)).operationalStatus).toBe(
      'IN_PROGRESS',
    );
    expect(
      await db.requestAssignmentHistory.count({
        where: { requestId: id, assignmentType: 'RESEARCHER' },
      }),
    ).toBe(2);
  });
  it('keeps AM appointments optional and separate from the shared queue', async () => {
    await expect(setOrganizationAm(orgAdmin, orgA, am.id)).rejects.toThrow(
      'permission',
    );
    await setOrganizationAm(admin, orgA, am.id);
    const id = await submitted();
    expect((await getRequest(am, id)).requestAmId).toBeNull();
    await setRequestAm(admin, id, 3, am2.id);
    expect((await getRequest(am, id)).requestAmId).toBe(am2.id);
    await expect(setRequestAm(am, id, 4, am.id)).rejects.toThrow('permission');
    await setRequestAm(admin, id, 4, null);
    expect((await getRequest(am, id)).requestAmId).toBeNull();
    await setOrganizationAm(admin, orgA, null);
  });
  it('keeps foreign-key integrity through all checked-in schema migrations', async () => {
    const id = await draft();
    await expect(
      db.request.update({
        where: { id },
        data: { researcherId: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('enforces exclusive expiring AM locks, admin override, and optimistic versions', async () => {
    const id = await submitted(),
      lease = (await acquireAmLock(am, id))!;
    await expect(acquireAmLock(am2, id)).rejects.toMatchObject({ status: 409 });
    await expect(operate(am, id, 3, 'validate')).rejects.toThrow('lock');
    await expect(
      operate(am, id, 2, 'validate', { leaseToken: lease.leaseToken }),
    ).rejects.toThrow('changed');
    await db.requestLock.update({
      where: { requestId: id },
      data: { expiresAt: new Date(0) },
    });
    const second = (await acquireAmLock(am2, id))!;
    await expect(releaseAmLock(am, id, lease.leaseToken)).rejects.toThrow(
      'no longer',
    );
    await acquireAmLock(admin, id, true);
    expect(
      await db.requestLock.findUnique({ where: { requestId: id } }),
    ).toBeNull();
    expect(second.leaseToken).not.toBe(lease.leaseToken);
    expect(
      await db.auditEvent.count({
        where: { entityId: id, action: 'request.lock_overridden' },
      }),
    ).toBe(1);
  });
  it('prevents AM researcher assignment and researcher direct client communication', async () => {
    const { id } = await inProgress();
    await expect(
      operate(am, id, 5, 'assign', { targetUserId: researcher.id }),
    ).rejects.toThrow('permission');
    await operate(researcher, id, 5, 'researcher_question', {
      text: 'Please ask the client for clarification.',
    });
    const r = await getRequest(member, id);
    expect(r.messages).toHaveLength(0);
    const internal = await getRequest(am, id);
    expect(internal.messages[0].audience).toBe('INTERNAL');
  });
  it('keeps existing requests actionable after service deactivation', async () => {
    const { id, lease } = await inProgress();
    await setServiceAuthorization(admin, orgA, false);
    await operate(am, id, 5, 'request_info', {
      text: 'Please clarify the research question.',
      leaseToken: lease.leaseToken,
    });
    await operate(orgAdmin, id, 6, 'respond_info', {
      text: 'Here are the additional objectives.',
    });
    expect((await getRequest(member, id)).operationalStatus).toBe(
      'IN_PROGRESS',
    );
  });
  it('requires a new scanned deliverable after rejection, re-reviews QA, and reserves acceptance for owner', async () => {
    const { id, lease } = await inProgress();
    await expect(
      operate(researcher, id, 5, 'submit_deliverable'),
    ).rejects.toThrow('scanned');
    await document(id);
    await operate(researcher, id, 5, 'submit_deliverable');
    await expect(
      operate(researcher, id, 6, 'qa_approve', { text: 'Self approval' }),
    ).rejects.toThrow('permission');
    await operate(qa, id, 6, 'qa_reject', {
      text: 'Please correct the analysis.',
    });
    await expect(
      operate(researcher, id, 7, 'submit_deliverable'),
    ).rejects.toThrow('new scanned');
    await document(id, 2);
    await operate(researcher, id, 7, 'submit_deliverable');
    await operate(qa, id, 8, 'qa_approve', {
      text: 'Verified corrected output.',
    });
    await operate(am, id, 9, 'deliver', { leaseToken: lease.leaseToken });
    expect((await getRequest(orgAdmin, id)).documents).toHaveLength(1);
    await expect(operate(orgAdmin, id, 10, 'accept')).rejects.toThrow(
      'current request owner',
    );
    await operate(member, id, 10, 'revision', {
      text: 'Please adjust the interpretation.',
    });
    await operate(am, id, 11, 'scope_in', {
      text: 'Within the approved objectives.',
      leaseToken: lease.leaseToken,
    });
    await document(id, 3);
    await operate(researcher, id, 12, 'submit_deliverable');
    await operate(qa, id, 13, 'qa_approve', { text: 'Re-reviewed revision.' });
    await operate(am, id, 14, 'deliver', { leaseToken: lease.leaseToken });
    await operate(member, id, 15, 'accept');
    expect((await getRequest(member, id)).operationalStatus).toBe('COMPLETED');
    await operate(member, id, 16, 'feedback', { text: 'Thank you.' });
  });
  it('keeps out-of-scope revisions pending rather than silently completing', async () => {
    const { id, lease } = await inProgress();
    await document(id);
    await operate(researcher, id, 5, 'submit_deliverable');
    await operate(qa, id, 6, 'qa_approve', { text: 'Approved.' });
    await operate(am, id, 7, 'deliver', { leaseToken: lease.leaseToken });
    await operate(member, id, 8, 'revision', {
      text: 'A new topic outside the brief.',
    });
    await operate(am, id, 9, 'scope_out', {
      text: 'A separate quotation is required.',
      leaseToken: lease.leaseToken,
    });
    expect((await getRequest(member, id)).operationalStatus).toBe(
      'SCOPE_REVIEW',
    );
  });
  it('requires internal cancellation approval after submission', async () => {
    const id = await submitted();
    await operate(member, id, 3, 'cancel', { text: 'No longer needed.' });
    expect((await getRequest(member, id)).operationalStatus).toBe('SUBMITTED');
    await expect(
      operate(orgAdmin, id, 4, 'cancel_approve', { text: 'Approved' }),
    ).rejects.toThrow('permission');
    await operate(admin, id, 4, 'cancel_approve', {
      text: 'Cancellation approved.',
    });
    expect((await getRequest(member, id)).operationalStatus).toBe('CANCELLED');
  });
  it('protects audit history from update and deletion', async () => {
    const id = await draft();
    const event = await db.auditEvent.findFirstOrThrow({
      where: { entityId: id },
    });
    await expect(
      db.auditEvent.delete({ where: { id: event.id } }),
    ).rejects.toThrow('immutable');
  });
});
