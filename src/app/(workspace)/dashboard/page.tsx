import Link from 'next/link';
import {
  Plus,
  Files,
  Clock3,
  CheckCircle2,
  ArrowUpRight,
  Bell,
  Building2,
} from 'lucide-react';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { requestScope } from '@/server/requests';
import { has } from '@/server/policy';
import { PageHeader, RequestsTable, StatusBadge } from '@/components/workspace';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';
export default async function Dashboard() {
  const actor = await requireActor();
  const scope = await requestScope(actor);
  const [requests, total, active, complete, approvals, notifications, orgs] =
    await Promise.all([
      db.request.findMany({
        where: scope,
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      db.request.count({ where: scope }),
      db.request.count({
        where: {
          AND: [
            scope,
            { operationalStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
          ],
        },
      }),
      db.request.count({
        where: { AND: [scope, { operationalStatus: 'COMPLETED' }] },
      }),
      db.request.count({
        where: { AND: [scope, { intakeStatus: 'PENDING_APPROVAL' }] },
      }),
      db.notification.findMany({
        where: { userId: actor.id },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      has(actor, 'organization.review')
        ? db.organization.findMany({
            where: { registrationStatus: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: 4,
          })
        : [],
    ]);
  const org = actor.organizationId
    ? await db.organization.findUnique({ where: { id: actor.organizationId } })
    : null;
  const marketing = has(actor, 'marketing.read');
  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title={`Welcome, ${actor.name.split(' ')[0]}`}
        description={
          marketing
            ? 'Your marketing workspace. Client research data is restricted.'
            : 'A clear view of your research and what needs your attention.'
        }
      >
        {has(actor, 'request.create') && (
          <Button asChild>
            <Link href="/requests/new">
              <Plus size={16} />
              New request
            </Link>
          </Button>
        )}
      </PageHeader>
      {org && !org.serviceAuthorized && (
        <p className="notice small" style={{ marginBottom: '1.5rem' }}>
          Your organization workspace is approved. Service access is not active
          yet. Approved requests will be held until iResearch activates service
          access; existing operational requests remain actionable.
        </p>
      )}
      {marketing ? (
        <div className="card empty">
          <h2>Acquisition reporting</h2>
          <p className="muted small">
            No acquisition data source is configured. Client requests and
            documents are not available to this role.
          </p>
        </div>
      ) : (
        <>
          <div className="grid four" style={{ marginBottom: '2rem' }}>
            {[
              {
                label: 'Total requests',
                value: total,
                icon: Files,
                caption: 'In your workspace',
              },
              {
                label: 'In progress',
                value: active,
                icon: Clock3,
                caption: 'Active operational requests',
              },
              {
                label: 'Awaiting approval',
                value: approvals,
                icon: Building2,
                caption: 'Organization review',
              },
              {
                label: 'Completed',
                value: complete,
                icon: CheckCircle2,
                caption: 'Accepted by the owner',
              },
            ].map((m) => (
              <div className="card metric" key={m.label}>
                <p className="eyebrow">{m.label}</p>
                <m.icon className="metric-icon" size={20} />
                <strong>{m.value}</strong>
                <p className="small muted">{m.caption}</p>
              </div>
            ))}
          </div>
          <div className="split">
            <div className="stack">
              {has(actor, 'organization.review') && (
                <section className="card stack">
                  <div className="row spread">
                    <h2>Organization registration review</h2>
                    <Link className="small muted" href="/organizations">
                      View all →
                    </Link>
                  </div>
                  {orgs.length ? (
                    orgs.map((o) => (
                      <Link
                        className="row spread"
                        key={o.id}
                        href={`/organizations/${o.id}`}
                      >
                        <div>
                          <h3>{o.name}</h3>
                          <p className="small muted">{o.contactEmail}</p>
                        </div>
                        <StatusBadge status="Pending review" />
                      </Link>
                    ))
                  ) : (
                    <p className="small muted">
                      No registrations awaiting review.
                    </p>
                  )}
                </section>
              )}
              <section className="stack">
                <div className="row spread">
                  <h2>Recent requests</h2>
                  <Link href="/requests" className="small muted">
                    View all requests →
                  </Link>
                </div>
                <RequestsTable requests={requests} actor={actor} />
              </section>
            </div>
            <aside className="stack">
              <section className="card">
                <div className="section-heading">
                  <Bell size={17} />
                  <h2>Latest updates</h2>
                </div>
                {notifications.length ? (
                  notifications.map((n) => (
                    <Link href={n.href} className="activity" key={n.id}>
                      <span className="activity-dot" />
                      <div>
                        <p>{n.title}</p>
                        <small>{date(n.createdAt)}</small>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="small muted" style={{ marginTop: '1rem' }}>
                    No updates yet. Notifications will appear as your requests
                    progress.
                  </p>
                )}
              </section>
              <section className="card stack">
                <p className="eyebrow">Development status</p>
                <h2>Integrations pending</h2>
                <p className="small muted">
                  Email, payment checkout, and private file services are
                  disabled.
                </p>
                <Link href="/settings" className="row small">
                  View configuration status
                  <ArrowUpRight size={14} />
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
