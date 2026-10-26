import Link from 'next/link';
import { Bell } from 'lucide-react';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, StatusBadge } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
import { date } from '@/lib/utils';
export default async function Notifications() {
  const actor = await requireActor();
  const notes = await db.notification.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <>
      <PageHeader
        eyebrow="Your workspace"
        title="Notifications"
        description="Updates and actions that need your attention."
      />
      {notes.length ? (
        <section className="stack">
          {notes.map((n) => (
            <article className="card row spread" key={n.id}>
              <div>
                <Link href={n.href}>
                  <h3>{n.title}</h3>
                </Link>
                <p className="small muted">{date(n.createdAt)}</p>
              </div>
              {n.readAt ? (
                <StatusBadge status="Read" />
              ) : (
                <CommandForm
                  command="notification_read"
                  id={n.id}
                  label="Mark as read"
                  variant="outline"
                />
              )}
            </article>
          ))}
        </section>
      ) : (
        <div className="card empty">
          <Bell size={28} />
          <h2>You’re all caught up</h2>
          <p className="small muted">Your updates will appear here.</p>
        </div>
      )}
    </>
  );
}
