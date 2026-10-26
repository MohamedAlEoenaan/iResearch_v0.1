import { CatalogPage } from '@/components/catalog';
export const dynamic = 'force-dynamic';
export default async function Services({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <CatalogPage kind="SERVICE" query={await searchParams} />;
}
