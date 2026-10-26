import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { has, roleDefinitions } from '@/server/policy';
import { integrations } from '@/server/integrations';
import { PageHeader, StatusBadge } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
export default async function Settings() {
  const actor = await requireActor();
  const internalUsers = has(actor, 'system.manage')
    ? await db.user.findMany({
        where: { accountType: 'INTERNAL' },
        include: { roles: true },
        orderBy: { name: 'asc' },
        take: 100,
      })
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Your profile and the current platform configuration."
      />
      <div className="grid two">
        <section className="card stack">
          <h2>Your profile</h2>
          <p className="small muted">{actor.email}</p>
          <CommandForm
            command="profile"
            fields={[
              {
                name: 'name',
                label: 'Full name',
                value: actor.name,
                required: true,
                minLength: 2,
                maxLength: 100,
              },
            ]}
            label="Save profile"
          />
          <p className="small muted">
            Account type: {actor.accountType.toLowerCase()}. Personal and
            organization accounts remain separate.
          </p>
          <CommandForm command="logout" label="Sign out" variant="outline" />
        </section>
        <section className="card">
          <h2>Integration status</h2>
          {Object.entries(integrations).map(([name, config]) => (
            <div key={name} className="integration-row">
              <div>
                <h3 style={{ textTransform: 'capitalize' }}>{name}</h3>
                <p>{config.reason}</p>
              </div>
              <StatusBadge
                status={config.state === 'BLOCKED' ? 'Blocked' : 'Imported'}
              />
            </div>
          ))}
        </section>
      </div>
      {internalUsers.length > 0 && (
        <section className="stack" style={{ marginTop: '2rem' }}>
          <h2>Internal role governance</h2>
          <p className="small muted">
            Role changes revoke existing sessions and are audited. Internal
            accounts are provisioned by the operator; public registration cannot
            create them.
          </p>
          {internalUsers.map((u) => (
            <div className="card row spread" key={u.id}>
              <div>
                <h3>{u.name}</h3>
                <p className="small muted">
                  {u.email} ·{' '}
                  {u.roles
                    .map((r) => roleDefinitions[r.roleId]?.label)
                    .join(', ')}
                </p>
              </div>
              <CommandForm
                command="internal_role"
                id={u.id}
                fields={[
                  {
                    name: 'roleId',
                    label: 'Internal role',
                    type: 'select',
                    required: true,
                    options: Object.entries(roleDefinitions)
                      .filter(([id]) =>
                        [
                          'AM',
                          'RESEARCHER',
                          'QA',
                          'MARKETING',
                          'ADMIN',
                          'SUPER_ADMIN',
                        ].includes(id),
                      )
                      .map(([id, r]) => ({ value: id, label: r.label })),
                  },
                ]}
                label="Change role"
                variant="outline"
              />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
