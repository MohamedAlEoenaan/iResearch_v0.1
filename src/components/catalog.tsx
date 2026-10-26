import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { db } from '@/lib/db';
import { PublicNav, PublicFooter } from './public';
import { Button } from './ui/button';
export async function CatalogPage({
  kind,
  query,
}: {
  kind: 'SERVICE' | 'PACKAGE';
  query: { q?: string; category?: string };
}) {
  const base = { active: true, kind };
  const [products, categories] = await Promise.all([
    db.service.findMany({
      where: {
        ...base,
        ...(query.q
          ? {
              name: {
                contains: query.q.slice(0, 100),
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    db.service.findMany({
      where: base,
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
  ]);
  return (
    <>
      <PublicNav />
      <main id="main" className="public-main">
        <div className="page-header">
          <div>
            <p className="eyebrow">The iResearch catalog</p>
            <h1 style={{ marginTop: '.8rem' }}>
              {kind === 'PACKAGE' ? 'Research packages' : 'Find your next step'}
            </h1>
            <p className="muted">
              {kind === 'PACKAGE'
                ? 'Connected services in one research package.'
                : 'Explore research services for your next question.'}
            </p>
          </div>
          <span className="badge">Official website catalog</span>
        </div>
        <form className="filter-bar">
          <label className="field">
            <span>Search {kind === 'PACKAGE' ? 'packages' : 'services'}</span>
            <input
              name="q"
              defaultValue={query.q}
              placeholder="Search by name"
              maxLength={100}
            />
          </label>
          {kind === 'SERVICE' && (
            <label className="field">
              <span>Category</span>
              <select name="category" defaultValue={query.category ?? ''}>
                <option value="">All categories</option>
                {categories
                  .filter((c) => c.category)
                  .map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <Button variant="outline">Search</Button>
        </form>
        {products.length ? (
          <div className="grid three">
            {products.map((s) => (
              <article className="card stack" key={s.id}>
                <p className="eyebrow">{s.category || 'iResearch services'}</p>
                <h2>{s.name}</h2>
                <p className="muted small">
                  {s.description.length > 180
                    ? s.description.slice(0, 180) + '…'
                    : s.description}
                </p>
                <div style={{ marginTop: 'auto' }}>
                  <strong style={{ fontSize: '1.25rem' }}>
                    {new Intl.NumberFormat('en-SA', {
                      style: 'currency',
                      currency: s.currency,
                    }).format(s.amount / 100)}
                  </strong>
                  <p className="small muted">VAT included</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/services/${s.id}`}>
                    View details
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="card empty">
            <BookOpen size={32} />
            <h2>No {kind === 'PACKAGE' ? 'packages' : 'services'} to show</h2>
            <p className="muted">Try a different search or category.</p>
          </div>
        )}
        <p className="notice small" style={{ marginTop: '1.5rem' }}>
          Prices match the official iResearch website catalog, retrieved 26
          October 2026, and include VAT. Payment checkout is currently disabled.
          You can prepare a draft after signing in.
        </p>
      </main>
      <PublicFooter />
    </>
  );
}
