import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, StatusBadge } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
import { date } from '@/lib/utils';
export default async function Catalog() {
  await requireActor('catalog.manage');
  const products = await db.service.findMany({
    orderBy: { name: 'asc' },
    take: 100,
  });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Service catalog"
        description="Official source entries, fixed prices including VAT, and visibility controls."
      />
      <p className="notice small" style={{ marginBottom: '1.5rem' }}>
        Imported from the public iResearch website. Prices are stored in
        halalas. Refreshes use the reviewed catalog import command; every import
        and visibility change is audited.
      </p>
      <div className="stack">
        {products.map((p) => (
          <article key={p.id} className="card row spread">
            <div>
              <h3>{p.name}</h3>
              <p className="small muted">
                {p.kind === 'PACKAGE' ? 'Package' : 'Service'} ·{' '}
                {new Intl.NumberFormat('en-SA', {
                  style: 'currency',
                  currency: p.currency,
                }).format(p.amount / 100)}{' '}
                · VAT included
              </p>
              <a
                className="small muted"
                href={p.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Official listing ↗
              </a>
              {p.sourceVerifiedAt && (
                <p className="small muted">
                  Source verified {date(p.sourceVerifiedAt)}
                </p>
              )}
            </div>
            <div className="row">
              <StatusBadge status={p.active ? 'Active' : 'Inactive'} />
              <CommandForm
                command="catalog_active"
                id={p.id}
                data={{ active: !p.active }}
                label={p.active ? 'Hide from catalog' : 'Show in catalog'}
                variant="outline"
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
