import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader } from '@/components/workspace';
import { date } from '@/lib/utils';
import Link from 'next/link';
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireActor('audit.read');
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const events = await db.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    skip: (page - 1) * 40,
  });
  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit trail"
        description="Append-only history of access changes and workflow decisions."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{e.action}</td>
                <td className="muted">{e.entityId.slice(0, 8)}</td>
                <td className="muted">{e.actorId?.slice(0, 8) ?? 'System'}</td>
                <td className="nowrap muted">{date(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row small" style={{ marginTop: '1rem' }}>
        {page > 1 && <Link href={`?page=${page - 1}`}>← Previous</Link>}
        {events.length === 40 && <Link href={`?page=${page + 1}`}>Next →</Link>}
      </div>
    </>
  );
}
