import { Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { requireActor } from '@/server/page-auth';
import { has, roleDefinitions } from '@/server/policy';
import { db } from '@/lib/db';
import { Brand } from '@/components/public';
import { WorkspaceNav } from '@/components/workspace-nav';
import { CommandForm } from '@/components/command-form';
export const dynamic = 'force-dynamic';
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  const org = actor.organizationId
    ? await db.organization.findUnique({ where: { id: actor.organizationId } })
    : null;
  const unread = await db.notification.count({
    where: { userId: actor.id, readAt: null },
  });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-context">
          <p className="eyebrow">Your workspace</p>
          <strong>
            {org?.name ??
              (actor.accountType === 'INTERNAL'
                ? 'iResearch operations'
                : 'Personal workspace')}
          </strong>
          <span className="small muted">
            {actor.roles.map((r) => roleDefinitions[r]?.label ?? r).join(' · ')}
          </span>
        </div>
        <WorkspaceNav
          catalog={has(actor, 'catalog.manage')}
          organizations={has(actor, 'organization.review')}
          members={has(actor, 'organization.manage_members')}
          audit={has(actor, 'audit.read')}
          requests={!has(actor, 'marketing.read')}
        />
        <div className="sidebar-bottom">
          <div className="row" style={{ marginBottom: '.8rem' }}>
            <span className="avatar">
              {actor.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong className="small">{actor.name}</strong>
              <p className="muted" style={{ fontSize: '.65rem' }}>
                V0.1 development
              </p>
            </div>
          </div>
          <CommandForm command="logout" label="Sign out" variant="ghost" />
        </div>
      </aside>
      <div>
        <header className="topbar">
          <div className="row">
            <span className="muted">Workspace</span>
            <ChevronRight size={13} className="muted" />
            <span>
              {actor.accountType === 'INTERNAL'
                ? 'Operations'
                : org
                  ? 'Organization'
                  : 'Individual'}
            </span>
          </div>
          <div className="row">
            <span className="small muted">
              <span className="workspace-dot" />
              Development
            </span>
            <Link
              className="button button-ghost"
              href="/notifications"
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell size={18} />
              {unread > 0 && <span className="badge">{unread}</span>}
            </Link>
          </div>
        </header>
        <main className="workspace-main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
