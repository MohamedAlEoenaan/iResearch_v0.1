import { notFound } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, BackLink, StatusBadge } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
export default async function Org({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActor('organization.review');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      users: { include: { roles: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!org) notFound();
  const managers = await db.user.findMany({
    where: {
      active: true,
      accountType: 'INTERNAL',
      roles: { some: { roleId: 'AM' } },
    },
    select: { id: true, name: true },
  });
  return (
    <>
      <BackLink href="/organizations" label="Organizations" />
      <PageHeader
        eyebrow="Organization administration"
        title={org.name}
        description={org.contactEmail}
      >
        <StatusBadge status={org.registrationStatus.toLowerCase()} />
      </PageHeader>
      <div className="grid two">
        <section className="card stack">
          <h2>Registration review</h2>
          <p className="small muted">
            Approval grants workspace access and appoints the registering
            contact as the first organization administrator. Email verification
            remains separate.
          </p>
          {org.registrationStatus === 'PENDING' ? (
            <>
              <CommandForm
                command="organization_review"
                id={id}
                data={{ approve: true }}
                label="Approve and appoint initial administrator"
                confirm="Approve this organization and appoint its registering contact as organization administrator?"
              />
              <CommandForm
                command="organization_review"
                id={id}
                data={{ approve: false }}
                fields={[
                  {
                    name: 'reason',
                    label: 'Reason for rejection',
                    type: 'textarea',
                    required: true,
                  },
                ]}
                label="Reject registration"
                variant="outline"
              />
            </>
          ) : (
            <p className="small">
              {org.rejectionReason ?? 'Registration review is complete.'}
            </p>
          )}
        </section>
        <section className="card stack">
          <h2>Service authorization</h2>
          <StatusBadge
            status={org.serviceAuthorized ? 'Active' : 'Not active'}
          />
          <p className="small muted">
            Activation releases approved requests into operations. Deactivation
            holds new submissions and leaves existing work actionable.
          </p>
          {org.registrationStatus === 'APPROVED' && (
            <CommandForm
              command="organization_activate"
              id={id}
              data={{ active: !org.serviceAuthorized }}
              label={
                org.serviceAuthorized
                  ? 'Deactivate service access'
                  : 'Activate services and release approved work'
              }
              variant={org.serviceAuthorized ? 'outline' : 'default'}
              confirm={
                org.serviceAuthorized
                  ? 'Prevent new operational submissions? Existing requests will continue.'
                  : 'Activate service access and release all approved waiting requests?'
              }
            />
          )}
        </section>
      </div>
      <section className="card stack" style={{ marginTop: '2rem' }}>
        <h2>Dedicated account manager · optional</h2>
        <p className="small muted">
          Dedicated organization contact:{' '}
          {managers.find((m) => m.id === org.dedicatedAmId)?.name ??
            'Not assigned'}
          . Request appointments remain separate; no automatic assignment
          occurs.
        </p>
        <CommandForm
          command="organization_am"
          id={id}
          fields={[
            {
              name: 'targetUserId',
              label: 'Account manager',
              type: 'select',
              required: true,
              options: managers.map((m) => ({ value: m.id, label: m.name })),
            },
          ]}
          label="Appoint organization account manager"
          variant="outline"
        />
        {org.dedicatedAmId && (
          <CommandForm
            command="organization_am"
            id={id}
            data={{ targetUserId: null }}
            label="Remove dedicated appointment"
            variant="outline"
          />
        )}
      </section>
      <section className="stack" style={{ marginTop: '2rem' }}>
        <h2>Members & administrator appointments</h2>
        <p className="small muted">
          Only an iResearch administrator can appoint or remove organization
          administrators. At least one active administrator must remain.
        </p>
        {org.users.map((u) => (
          <div className="card row spread" key={u.id}>
            <div>
              <h3>{u.name}</h3>
              <p className="small muted">
                {u.email} ·{' '}
                {u.roles.some((r) => r.roleId === 'ORG_ADMIN')
                  ? 'Organization administrator'
                  : 'Member'}{' '}
                · {u.verifiedAt ? 'Email verified' : 'Verification pending'}
              </p>
              <StatusBadge status={u.active ? 'Active' : 'Inactive'} />
            </div>
            <div className="row">
              {org.workspaceActive && u.active && (
                <CommandForm
                  command="organization_admin"
                  id={u.id}
                  data={{
                    appoint: !u.roles.some((r) => r.roleId === 'ORG_ADMIN'),
                  }}
                  label={
                    u.roles.some((r) => r.roleId === 'ORG_ADMIN')
                      ? 'Remove administrator role'
                      : 'Appoint administrator'
                  }
                  variant="outline"
                />
              )}
              <CommandForm
                command="member_active"
                id={u.id}
                data={{ active: !u.active }}
                label={u.active ? 'Deactivate' : 'Reactivate'}
                variant="outline"
              />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
