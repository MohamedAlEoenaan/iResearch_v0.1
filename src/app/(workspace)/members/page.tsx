import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, StatusBadge } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
import { date } from '@/lib/utils';
export default async function Members() {
  const actor = await requireActor('organization.manage_members');
  const [members, invitations] = await Promise.all([
    db.user.findMany({
      where: {
        organizationId: actor.organizationId!,
        accountType: 'ORGANIZATION',
      },
      include: { roles: true },
      orderBy: { name: 'asc' },
    }),
    db.organizationInvitation.findMany({
      where: { organizationId: actor.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Organization workspace"
        title="Your team"
        description="Invite colleagues and manage ordinary members. Administrator roles are controlled by iResearch."
      />
      <div className="split">
        <section className="stack">
          {members.map((m) => (
            <div className="card row spread" key={m.id}>
              <div>
                <h3>{m.name}</h3>
                <p className="small muted">{m.email}</p>
                <p className="small muted">
                  {m.roles.some((r) => r.roleId === 'ORG_ADMIN')
                    ? 'Organization administrator'
                    : 'Member'}
                </p>
              </div>
              <div className="row">
                <StatusBadge status={m.active ? 'Active' : 'Inactive'} />
                {m.id !== actor.id &&
                  !m.roles.some((r) => r.roleId === 'ORG_ADMIN') && (
                    <CommandForm
                      command="member_active"
                      id={m.id}
                      data={{ active: !m.active }}
                      label={m.active ? 'Deactivate' : 'Reactivate'}
                      variant="outline"
                    />
                  )}
              </div>
            </div>
          ))}
        </section>
        <aside className="card stack">
          <h2>Invite a member</h2>
          <p className="notice small">
            Email delivery is disabled. Invitations can be recorded, but cannot
            be delivered yet.
          </p>
          <CommandForm
            command="invite"
            label="Record invitation"
            fields={[
              {
                name: 'email',
                label: 'Colleague’s email',
                type: 'email',
                required: true,
              },
            ]}
          />
        </aside>
      </div>
      <section className="stack" style={{ marginTop: '2rem' }}>
        <h2>Invitation history</h2>
        {invitations.length ? (
          invitations.map((i) => (
            <div className="card row spread" key={i.id}>
              <div>
                <h3>{i.email}</h3>
                <p className="small muted">Expires {date(i.expiresAt)}</p>
              </div>
              <StatusBadge
                status={
                  i.acceptedAt
                    ? 'Accepted'
                    : i.revokedAt
                      ? 'Revoked'
                      : i.expiresAt < new Date()
                        ? 'Expired'
                        : 'Delivery blocked'
                }
              />
            </div>
          ))
        ) : (
          <p className="small muted">No invitations have been recorded.</p>
        )}
      </section>
    </>
  );
}
