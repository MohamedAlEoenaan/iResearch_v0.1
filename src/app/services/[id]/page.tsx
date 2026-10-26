import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { db } from '@/lib/db';
import { PublicNav, PublicFooter } from '@/components/public';
import { Button } from '@/components/ui/button';
import { BackLink } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const service = await db.service.findFirst({ where: { id, active: true } });
  if (!service) notFound();
  return (
    <>
      <PublicNav />
      <main id="main" className="public-main">
        <BackLink
          href={service.kind === 'PACKAGE' ? '/packages' : '/services'}
          label={service.kind === 'PACKAGE' ? 'All packages' : 'All services'}
        />
        <div className="split">
          <article className="stack">
            <p className="eyebrow">
              {service.category || 'iResearch services'}
            </p>
            <h1>{service.name}</h1>
            <p className="requirements">{service.description}</p>
          </article>
          <aside className="card stack">
            <p className="eyebrow">
              {service.kind === 'PACKAGE' ? 'Package' : 'Service'} price
            </p>
            <h2 style={{ fontSize: '1.8rem' }}>
              {new Intl.NumberFormat('en-SA', {
                style: 'currency',
                currency: service.currency,
              }).format(service.amount / 100)}
            </h2>
            <p className="small muted">VAT included</p>
            <Button asChild>
              <Link href={`/requests/new?serviceId=${id}`}>
                Prepare a request
              </Link>
            </Button>
            <p className="notice small">
              Payment checkout is disabled. Preparing a draft does not purchase
              or submit this service.
            </p>
            <a
              className="small muted"
              href={service.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View the official website listing ↗
            </a>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
