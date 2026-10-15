import { MasterPage } from '@/components/master-page';

/**
 * Halaman master produk.
 *
 * Filter suplier bisa diisi dari URL (`/pos/produk?supplierId=…`) — halaman
 * detail suplier menautkan ke sini supaya produk satu suplier langsung
 * tersaring tanpa harus memilih ulang di dropdown.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const { supplierId } = await searchParams;
  return <MasterPage kind="products" initialSupplierId={supplierId} />;
}
