import Link from 'next/link';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, StatusBadge } from '@/components/workspace';
import { date } from '@/lib/utils';
export default async function Organizations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireActor('organization.review');
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    skip: (page - 1) * 30,
    include: { _count: { select: { users: true } } },
  });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Organizations"
        description="Registration review, workspace access, and service authorization."
      />
      {organizations.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Registration</th>
                <th>Service access</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/organizations/${o.id}`}>
                      <strong>{o.name}</strong>
                    </Link>
                    <span className="muted">
                      {o.contactEmail} · {date(o.createdAt)}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={o.registrationStatus.toLowerCase()} />
                  </td>
                  <td>
                    <StatusBadge
                      status={o.serviceAuthorized ? 'Active' : 'Not active'}
                    />
                  </td>
                  <td>{o._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">
          <h2>No organizations yet</h2>
          <p className="muted small">
            New organization registrations will appear here for review.
          </p>
        </div>
      )}
      <div className="row" style={{ marginTop: '1rem' }}>
        {page > 1 && (
          <Link href={`?page=${page - 1}`} className="small">
            ← Previous
          </Link>
        )}
        {organizations.length === 30 && (
          <Link href={`?page=${page + 1}`} className="small">
            Next →
          </Link>
        )}
      </div>
    </>
  );
}
