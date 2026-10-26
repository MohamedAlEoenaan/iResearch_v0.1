import { CatalogPage } from '@/components/catalog';
export const dynamic = 'force-dynamic';
export default async function Packages({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <CatalogPage kind="PACKAGE" query={await searchParams} />;
}
