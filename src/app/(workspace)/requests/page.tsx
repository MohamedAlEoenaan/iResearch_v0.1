import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { requestScope } from '@/server/requests';
import { has } from '@/server/policy';
import { PageHeader, RequestsTable } from '@/components/workspace';
import { Button } from '@/components/ui/button';
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const actor = await requireActor();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const filters: Record<string, Prisma.RequestWhereInput> = {
    approval: { intakeStatus: 'PENDING_APPROVAL' },
    active: { operationalStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
    completed: { operationalStatus: 'COMPLETED' },
    drafts: {
      operationalStatus: null,
      intakeStatus: { in: ['DRAFT', 'DRAFT_FOR_REVISION'] },
    },
    action: { operationalStatus: 'PENDING_CLIENT_INFORMATION' },
    review: { operationalStatus: 'CLIENT_REVIEW' },
  };
  const where: Prisma.RequestWhereInput = {
    AND: [
      await requestScope(actor),
      query.q
        ? { title: { contains: query.q.slice(0, 160), mode: 'insensitive' } }
        : {},
      filters[query.filter ?? ''] ?? {},
    ],
  };
  const [requests, count] = await Promise.all([
    db.request.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.request.count({ where }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Research workspace"
        title={
          actor.accountType === 'INTERNAL' ? 'Request queue' : 'Your requests'
        }
        description={
          actor.accountType === 'INTERNAL'
            ? 'A shared queue. Account managers acquire a lease before editing.'
            : 'Manage your drafts, approvals, and research progress.'
        }
      >
        {has(actor, 'request.create') && (
          <Button asChild>
            <Link href="/requests/new">
              <Plus size={15} />
              New request
            </Link>
          </Button>
        )}
      </PageHeader>
      <form className="filter-bar">
        <label className="field">
          <span>Search requests</span>
          <input
            name="q"
            placeholder="Search by title"
            defaultValue={query.q}
            maxLength={160}
          />
        </label>
        <label className="field">
          <span>Filter</span>
          <select name="filter" defaultValue={query.filter ?? ''}>
            <option value="">All requests</option>
            <option value="drafts">Drafts</option>
            <option value="approval">Awaiting organization approval</option>
            <option value="active">Active work</option>
            <option value="action">Action required</option>
            <option value="review">Ready for review</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <Button variant="outline">Apply filters</Button>
      </form>
      <RequestsTable requests={requests} actor={actor} />
      <div className="row spread small muted" style={{ marginTop: '1rem' }}>
        <span>
          {count} request{count === 1 ? '' : 's'} · page {page} of{' '}
          {Math.max(1, Math.ceil(count / 20))}
        </span>
        <div className="row">
          {page > 1 && (
            <Link
              href={`/requests?${new URLSearchParams({ q: query.q ?? '', filter: query.filter ?? '', page: String(page - 1) })}`}
            >
              ← Previous
            </Link>
          )}
          {page * 20 < count && (
            <Link
              href={`/requests?${new URLSearchParams({ q: query.q ?? '', filter: query.filter ?? '', page: String(page + 1) })}`}
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
