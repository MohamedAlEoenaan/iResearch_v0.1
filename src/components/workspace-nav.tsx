'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Files,
  Building2,
  UsersRound,
  Bell,
  Settings2,
  ScrollText,
  BookOpen,
} from 'lucide-react';
export function WorkspaceNav({
  organizations,
  members,
  audit,
  requests,
  catalog,
}: {
  organizations: boolean;
  members: boolean;
  audit: boolean;
  requests: boolean;
  catalog: boolean;
}) {
  const path = usePathname();
  const items = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    ...(requests
      ? [{ href: '/requests', label: 'Requests', icon: Files }]
      : []),
    ...(organizations
      ? [{ href: '/organizations', label: 'Organizations', icon: Building2 }]
      : []),
    ...(members
      ? [{ href: '/members', label: 'Members', icon: UsersRound }]
      : []),
    ...(catalog
      ? [{ href: '/catalog', label: 'Catalog', icon: BookOpen }]
      : []),
    { href: '/notifications', label: 'Notifications', icon: Bell },
    ...(audit
      ? [{ href: '/audit', label: 'Audit trail', icon: ScrollText }]
      : []),
    { href: '/settings', label: 'Settings', icon: Settings2 },
  ];
  return (
    <nav aria-label="Workspace navigation">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`nav-link ${path.startsWith(i.href) ? 'active' : ''}`}
          aria-current={path.startsWith(i.href) ? 'page' : undefined}
        >
          <i.icon size={18} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
