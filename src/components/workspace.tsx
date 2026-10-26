import Link from 'next/link';
import { ArrowUpRight, FolderOpen } from 'lucide-react';
import { date } from '@/lib/utils';
import { clientStatus, type Actor } from '@/server/policy';
import type { Request } from '@prisma/client';
import { Button } from './ui/button';
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow" style={{ marginBottom: '.7rem' }}>
          {eyebrow}
        </p>
        <h1>{title}</h1>
        {description && <p className="muted small">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const cls =
    /completed|approved|active|connected/i.test(status) &&
    !/inactive|awaiting/.test(status)
      ? 'success'
      : /pending|awaiting|changes|blocked|unavailable/i.test(status)
        ? 'warn'
        : /cancelled|rejected/i.test(status)
          ? 'danger'
          : 'info';
  return <span className={`badge ${cls}`}>{status}</span>;
}
export function RequestsTable({
  requests,
  actor,
}: {
  requests: Request[];
  actor: Actor;
}) {
  if (!requests.length)
    return (
      <div className="card empty">
        <FolderOpen size={30} />
        <h3>No requests to show</h3>
        <p className="muted small">
          Requests will appear here when they’re created or become available to
          you.
        </p>
        {actor.accountType !== 'INTERNAL' && (
          <Button asChild variant="outline">
            <Link href="/requests/new">
              Create a request
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        )}
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Status</th>
            <th>Created</th>
            <th aria-label="Open request" />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/requests/${r.id}`}>
                  <strong>{r.title}</strong>
                </Link>
                <span className="muted">
                  REQ-{r.id.slice(0, 8).toUpperCase()}
                </span>
              </td>
              <td>
                <StatusBadge
                  status={
                    actor.accountType === 'INTERNAL'
                      ? (r.operationalStatus
                          ?.replaceAll('_', ' ')
                          .toLowerCase() ?? r.intakeStatus)
                      : clientStatus(r.operationalStatus, r.intakeStatus)
                  }
                />
              </td>
              <td className="nowrap muted">{date(r.createdAt)}</td>
              <td>
                <Link
                  className="button button-ghost"
                  href={`/requests/${r.id}`}
                  aria-label={`Open ${r.title}`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="muted small"
      style={{ display: 'inline-block', marginBottom: '1.4rem' }}
    >
      ← {label}
    </Link>
  );
}
