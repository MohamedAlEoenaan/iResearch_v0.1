import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import {
  LockKeyhole,
  FileText,
  MessageSquare,
  ShieldCheck,
  History,
  ArrowUpRight,
} from 'lucide-react';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { getRequest } from '@/server/requests';
import { has, isOrgAdmin, clientStatus } from '@/server/policy';
import { DomainError } from '@/server/errors';
import { PageHeader, StatusBadge, BackLink } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
import { LockPanel } from '@/components/lock-panel';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getRequest(actor, id).catch((e) => {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  });
  const internal = actor.accountType === 'INTERNAL',
    owner = r.currentOwnerId === actor.id,
    admin = isOrgAdmin(actor, r.organizationId),
    status = r.operationalStatus;
  const users = await db.user.findMany({
    where: {
      active: true,
      OR: [
        ...(admin ? [{ organizationId: r.organizationId }] : []),
        ...(has(actor, 'request.assign')
          ? [
              {
                accountType: 'INTERNAL' as const,
                roles: { some: { roleId: 'RESEARCHER' } },
              },
            ]
          : []),
      ],
    },
    select: { id: true, name: true, email: true, accountType: true },
  });
  const managers = has(actor, 'request.assign_am')
    ? await db.user.findMany({
        where: {
          active: true,
          accountType: 'INTERNAL',
          roles: { some: { roleId: 'AM' } },
        },
        select: { id: true, name: true },
      })
    : [];
  const assignedAm =
    internal && r.requestAmId
      ? await db.user.findUnique({
          where: { id: r.requestAmId },
          select: { name: true },
        })
      : null;
  const ownerUser = await db.user.findUnique({
    where: { id: r.currentOwnerId },
    select: { name: true },
  });
  const canEdit =
    owner &&
    ['DRAFT', 'DRAFT_FOR_REVISION'].includes(r.intakeStatus) &&
    !r.lockedRequirementsSnapshotId;
  const op = (
    action: string,
    label: string,
    textLabel?: string,
    variant: 'default' | 'outline' | 'destructive' = 'default',
  ) => (
    <CommandForm
      command="operate"
      id={id}
      version={r.version}
      data={{ action }}
      label={label}
      variant={variant}
      fields={
        textLabel
          ? [
              {
                name: 'text',
                label: textLabel,
                type: 'textarea',
                required: true,
              },
            ]
          : []
      }
    />
  );
  return (
    <>
      <BackLink href="/requests" label="All requests" />
      <PageHeader
        eyebrow={`REQ-${id.slice(0, 8).toUpperCase()}`}
        title={r.title}
        description={`Created ${date(r.createdAt)} · ${r.organization?.name ?? 'Personal request'}`}
      >
        <StatusBadge
          status={
            internal
              ? (status?.replaceAll('_', ' ').toLowerCase() ?? r.intakeStatus)
              : clientStatus(status, r.intakeStatus)
          }
        />
      </PageHeader>
      <div className="split">
        <div className="stack">
          <section className="card stack">
            <div className="section-heading">
              <FileText size={18} />
              <h2>Research requirements</h2>
            </div>
            {r.lockedRequirementsSnapshotId && (
              <p className="notice small row">
                <LockKeyhole size={15} />
                Approved requirements are locked. Later information is recorded
                separately.
              </p>
            )}
            {canEdit ? (
              <CommandForm
                command="edit_draft"
                id={id}
                version={r.version}
                label="Save changes"
                fields={[
                  {
                    name: 'title',
                    label: 'Request title',
                    value: r.title,
                    required: true,
                    minLength: 3,
                    maxLength: 160,
                  },
                  {
                    name: 'requirements',
                    label: 'Requirements',
                    type: 'textarea',
                    value: r.requirements,
                    required: true,
                    minLength: 20,
                    maxLength: 50000,
                  },
                ]}
              />
            ) : (
              <p className="requirements">{r.requirements}</p>
            )}
          </section>
          {owner && r.accountType === 'ORGANIZATION' && canEdit && (
            <section className="card stack">
              <h2>Organization approval</h2>
              <p className="muted small">
                Submit this draft for review by an organization administrator.
              </p>
              <CommandForm
                command="submit_approval"
                id={id}
                version={r.version}
                label="Submit for organization approval"
              />
            </section>
          )}
          {owner && r.accountType === 'INDIVIDUAL' && canEdit && (
            <section className="card stack">
              <h2>{r.serviceId ? 'Checkout' : 'Custom quotation'}</h2>
              <p className="notice small">
                {r.serviceId
                  ? 'Payment integration is disabled. This request will remain a draft until a real payment can be verified.'
                  : 'Custom quotation conversion is not configured. Your enquiry is saved as a draft.'}
              </p>
              <Button disabled>
                {r.serviceId
                  ? 'Checkout unavailable'
                  : 'Quotation conversion unavailable'}
              </Button>
            </section>
          )}
          {admin && r.intakeStatus === 'PENDING_APPROVAL' && (
            <section className="card stack">
              <div className="section-heading">
                <ShieldCheck size={18} />
                <h2>Review this request</h2>
              </div>
              <p className="muted small">
                Approval freezes the requirements.
                {owner ? ' Your self-approval will be recorded.' : ''}
              </p>
              <CommandForm
                command="decide_approval"
                id={id}
                version={r.version}
                data={{ approve: true }}
                label="Approve requirements"
                confirm="Approve and permanently freeze these requirements?"
              />
              <CommandForm
                command="decide_approval"
                id={id}
                version={r.version}
                data={{ approve: false }}
                label="Return for changes"
                variant="outline"
                fields={[
                  {
                    name: 'reason',
                    label: 'Reason for rejection',
                    type: 'textarea',
                    required: true,
                  },
                ]}
              />
            </section>
          )}
          {(owner || admin) && status === 'PENDING_CLIENT_INFORMATION' && (
            <section className="card stack">
              <h2>Your input is needed</h2>
              {op('respond_info', 'Send response', 'Your clarification')}
            </section>
          )}
          {has(actor, 'request.am') &&
            status &&
            !['COMPLETED', 'CANCELLED'].includes(status) && (
              <LockPanel
                id={id}
                version={r.version}
                status={status}
                holder={r.lock?.holderAmId ?? null}
                expires={r.lock?.expiresAt.toISOString() ?? null}
              />
            )}
          {has(actor, 'request.assign') &&
            [
              'READY_FOR_ASSIGNMENT',
              'IN_PROGRESS',
              'REVISION_REQUIRED',
              'PENDING_CLIENT_INFORMATION',
            ].includes(status ?? '') && (
              <section className="card stack">
                <h2>
                  {r.researcherId
                    ? 'Reassign research work'
                    : 'Assign a researcher'}
                </h2>
                <CommandForm
                  command="operate"
                  id={id}
                  version={r.version}
                  data={{ action: 'assign' }}
                  label={
                    r.researcherId ? 'Reassign researcher' : 'Assign researcher'
                  }
                  fields={[
                    {
                      name: 'targetUserId',
                      label: 'Researcher',
                      type: 'select',
                      required: true,
                      options: users
                        .filter((u) => u.accountType === 'INTERNAL')
                        .map((u) => ({ value: u.id, label: u.name })),
                    },
                  ]}
                />
              </section>
            )}
          {has(actor, 'request.research') &&
            r.researcherId === actor.id &&
            ['IN_PROGRESS', 'REVISION_REQUIRED'].includes(status ?? '') && (
              <section className="card stack">
                <h2>Researcher workspace</h2>
                <p className="notice small">
                  File storage is disabled. A scanned deliverable is required
                  before QA submission.
                </p>
                <Button disabled>Upload deliverable unavailable</Button>
                {op(
                  'submit_deliverable',
                  'Submit latest deliverable for QA',
                  undefined,
                  'outline',
                )}
                {status === 'IN_PROGRESS' &&
                  op(
                    'researcher_question',
                    'Send question to account manager',
                    'Question for the account manager',
                    'outline',
                  )}
                <p className="small muted">
                  Researcher messages are internal and never sent directly to
                  the client.
                </p>
              </section>
            )}
          {has(actor, 'request.qa') && status === 'QA_REVIEW' && (
            <section className="card stack">
              <h2>Quality assurance review</h2>
              <p className="small muted">
                Review the latest scanned deliverable. QA cannot edit
                deliverable files.
              </p>
              {op('qa_approve', 'Approve deliverable', 'QA comments')}
              {op(
                'qa_reject',
                'Return to researcher',
                'Required changes',
                'outline',
              )}
            </section>
          )}
          {owner && status === 'CLIENT_REVIEW' && (
            <section className="card stack">
              <h2>Review your deliverable</h2>
              <p className="small muted">
                Accept the output or request a revision. Only you, as the
                current owner, can make this decision.
              </p>
              {op('accept', 'Accept and complete request')}
              {op(
                'revision',
                'Request a revision',
                'Describe your revision',
                'outline',
              )}
            </section>
          )}
          {status === 'SCOPE_REVIEW' &&
            r.revisions.some((v) => v.scopeDecision === 'OUT_OF_SCOPE') && (
              <section className="card stack">
                <h2>Separate enquiry required</h2>
                <p className="notice small">
                  The revision was assessed as outside the approved scope. This
                  request remains under scope review until explicitly resolved.
                  A new enquiry can be created without completing the original
                  request.
                </p>
                {has(actor, 'request.create') && (
                  <Button asChild variant="outline">
                    <Link href="/requests/new">
                      Create a separate enquiry
                      <ArrowUpRight size={15} />
                    </Link>
                  </Button>
                )}
              </section>
            )}
          {(owner || admin) &&
            r.lockedRequirementsSnapshotId &&
            status !== 'COMPLETED' &&
            status !== 'CANCELLED' &&
            status !== 'PENDING_CLIENT_INFORMATION' && (
              <section className="card stack">
                <h2>Add a clarification</h2>
                <p className="small muted">
                  Additional information is recorded separately from the
                  approved requirements.
                </p>
                {op(
                  'clarification',
                  'Append clarification',
                  'Additional information',
                  'outline',
                )}
              </section>
            )}
          <section className="card stack">
            <div className="section-heading">
              <MessageSquare size={18} />
              <h2>
                {internal
                  ? 'Conversation & internal notes'
                  : 'Updates & clarifications'}
              </h2>
            </div>
            {r.messages.length ? (
              r.messages.map((m) => (
                <article
                  key={m.id}
                  className="stack"
                  style={{
                    gap: '.4rem',
                    borderBottom: '1px solid var(--line)',
                    paddingBottom: '1rem',
                  }}
                >
                  <div className="row spread">
                    <span className="eyebrow">
                      {m.audience === 'INTERNAL'
                        ? 'Internal note'
                        : 'Request update'}
                    </span>
                    <small className="muted">{date(m.createdAt)}</small>
                  </div>
                  <p className="requirements">{m.text}</p>
                  {m.actionRequired && !m.resolvedAt && (
                    <StatusBadge status="Action required" />
                  )}
                </article>
              ))
            ) : (
              <p className="muted small">
                No messages yet. Request updates and clarifications will be
                recorded here.
              </p>
            )}
          </section>
          <section className="card stack">
            <div className="section-heading">
              <FileText size={18} />
              <h2>Files & deliverables</h2>
            </div>
            <p className="notice small">
              Private storage and malware scanning are disabled. Uploads and
              downloads are unavailable.
            </p>
            {r.documents.map((d) => (
              <div key={d.id} className="row spread">
                <span className="small">
                  {d.fileName} · version {d.version}
                </span>
                <StatusBadge status="Download unavailable" />
              </div>
            ))}
          </section>
          {internal && r.reviews.length > 0 && (
            <section className="card stack">
              <h2>QA review history</h2>
              {r.reviews.map((review) => (
                <div key={review.id}>
                  <StatusBadge status={review.decision} />
                  <p className="small">{review.comments}</p>
                  <small className="muted">{date(review.createdAt)}</small>
                </div>
              ))}
            </section>
          )}
          {owner && status === 'COMPLETED' && (
            <section className="card stack">
              <h2>Share your feedback</h2>
              <p className="small muted">Feedback is optional.</p>
              {op('feedback', 'Save feedback', 'Your feedback')}
              {r.feedback && <p className="small">{r.feedback}</p>}
            </section>
          )}
        </div>
        <aside className="stack">
          <section className="card stack">
            <h2>Request details</h2>
            <dl className="details-grid">
              <div>
                <dt>Owner</dt>
                <dd>{ownerUser?.name ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  {r.accountType === 'ORGANIZATION'
                    ? 'Organization'
                    : 'Individual'}
                </dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{r.service?.name ?? 'Custom enquiry'}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{date(r.updatedAt)}</dd>
              </div>
            </dl>
            <p className="small muted">
              Version {r.version} · Original creator is preserved when ownership
              changes.
            </p>
          </section>
          {internal && (
            <section className="card stack">
              <h2>Account manager appointment</h2>
              <p className="small muted">
                {assignedAm?.name ??
                  'Shared account manager queue · unassigned'}
              </p>
              {has(actor, 'request.assign_am') &&
                status &&
                !['COMPLETED', 'CANCELLED'].includes(status) && (
                  <>
                    <CommandForm
                      command="request_am"
                      id={id}
                      version={r.version}
                      fields={[
                        {
                          name: 'targetUserId',
                          label: 'Account manager',
                          type: 'select',
                          required: true,
                          options: managers.map((m) => ({
                            value: m.id,
                            label: m.name,
                          })),
                        },
                      ]}
                      label="Appoint request account manager"
                      variant="outline"
                    />
                    {r.requestAmId && (
                      <CommandForm
                        command="request_am"
                        id={id}
                        version={r.version}
                        data={{ targetUserId: null }}
                        label="Return to shared queue"
                        variant="outline"
                      />
                    )}
                  </>
                )}
            </section>
          )}
          {r.approvals.length > 0 && (
            <section className="card stack">
              <div className="section-heading">
                <History size={16} />
                <h2>Approval history</h2>
              </div>
              {r.approvals.map((a) => (
                <div key={a.id} className="stack" style={{ gap: '.4rem' }}>
                  <div className="row spread">
                    <strong className="small">Attempt {a.attempt}</strong>
                    <StatusBadge status={a.decision.toLowerCase()} />
                  </div>
                  {a.reason && <p className="small muted">{a.reason}</p>}
                  <small className="muted">
                    {date(a.decidedAt ?? a.submittedAt)}
                  </small>
                </div>
              ))}
            </section>
          )}
          {admin &&
            status !== 'COMPLETED' &&
            status !== 'CANCELLED' &&
            r.intakeStatus !== 'CANCELLED' && (
              <section className="card stack">
                <h2>Ownership & access</h2>
                <CommandForm
                  command="transfer_owner"
                  id={id}
                  version={r.version}
                  label="Transfer ownership"
                  variant="outline"
                  fields={[
                    {
                      name: 'targetUserId',
                      label: 'New request owner',
                      type: 'select',
                      required: true,
                      options: users
                        .filter((u) => u.id !== r.currentOwnerId)
                        .map((u) => ({ value: u.id, label: u.name })),
                    },
                  ]}
                />
                <CommandForm
                  command="grant_access"
                  id={id}
                  data={{ revoke: false }}
                  label="Grant view-only access"
                  variant="outline"
                  fields={[
                    {
                      name: 'targetUserId',
                      label: 'Member',
                      type: 'select',
                      required: true,
                      options: users.map((u) => ({
                        value: u.id,
                        label: u.name,
                      })),
                    },
                  ]}
                />
                <CommandForm
                  command="grant_access"
                  id={id}
                  data={{ revoke: true }}
                  label="Revoke shared access"
                  variant="outline"
                  fields={[
                    {
                      name: 'targetUserId',
                      label: 'Member',
                      type: 'select',
                      required: true,
                      options: users.map((u) => ({
                        value: u.id,
                        label: u.name,
                      })),
                    },
                  ]}
                />
              </section>
            )}
          {(owner || admin) &&
            status !== 'COMPLETED' &&
            status !== 'CANCELLED' &&
            r.intakeStatus !== 'CANCELLED' && (
              <section className="card stack">
                <h2>Cancellation</h2>
                <p className="small muted">
                  {status
                    ? 'An internal administrator must approve cancellation after operational submission.'
                    : 'This request can be cancelled before operational submission.'}
                </p>
                {op(
                  'cancel',
                  status ? 'Request cancellation' : 'Cancel request',
                  'Reason for cancellation',
                  'destructive',
                )}
              </section>
            )}
          {r.cancellations.length > 0 && (
            <section className="card stack">
              <h2>Cancellation history</h2>
              {r.cancellations.map((c) => (
                <div key={c.id}>
                  <StatusBadge status={c.decision.toLowerCase()} />
                  <p className="small muted">{c.reason}</p>
                </div>
              ))}
              {has(actor, 'request.cancel_decide') &&
                r.cancellations.some((c) => c.decision === 'PENDING') && (
                  <>
                    {op(
                      'cancel_approve',
                      'Approve cancellation',
                      'Decision comments',
                      'destructive',
                    )}
                    {op(
                      'cancel_reject',
                      'Decline cancellation',
                      'Decision comments',
                      'outline',
                    )}
                  </>
                )}
            </section>
          )}
          {has(actor, 'request.lock_override') && r.lock && (
            <section className="card stack">
              <h2>Lock administration</h2>
              <CommandForm
                command="override_lock"
                id={id}
                label="Release editing lock"
                variant="outline"
                confirm="Override this account manager’s editing lease? This is audited."
              />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
