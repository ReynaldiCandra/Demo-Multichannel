import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';

/**
 * Jumlah produk teratas yang ikut dikirim di daftar suplier.
 *
 * Satu suplier bisa punya puluhan produk; halaman daftar hanya butuh gambaran
 * (3 teratas menurut omzet) + hitungan total, dan sisanya dibuka di halaman
 * detail /suppliers/[supplierId]. Tanpa batas ini, satu response berisi seluruh
 * produk SEMUA suplier sekaligus.
 */
export const SUPPLIER_TOP_PRODUCTS = 3;

export type SupplierProductStat = {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Pcs terjual dari transaksi berstatus "selesai". */
  totalSold: number;
  transactionCount: number;
  revenue: number;
};

export type SupplierProductSummary = {
  /** Jumlah SELURUH produk suplier — bukan panjang `products` yang terpotong. */
  productCount: number;
  totalSold: number;
  transactionCount: number;
  revenue: number;
};

/**
 * Hanya penjualan "selesai" yang dihitung — batal/retur/sedang dikirim tidak
 * pernah masuk omzet, sama seperti dashboard & laporan.
 */
const totalSoldSql = sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} else 0 end), 0)`;
const transactionCountSql = sql<string>`count(case when ${salesTable.status} = 'selesai' then ${salesTable.id} end)`;
const revenueSql = sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} else 0 end), 0)`;

/**
 * Statistik penjualan per produk yang punya suplier, diagregasi di database
 * dan dikelompokkan per suplier.
 *
 * Urutan hasil: omzet menurun, jadi elemen pertama tiap suplier adalah produk
 * terlarisnya (`slice(0, SUPPLIER_TOP_PRODUCTS)` cukup untuk daftar).
 *
 * `supplierId` opsional: diisi hanya saat halaman detail mengambil produk satu
 * suplier, supaya tenant lain tidak pernah ikut terhitung (workspaceId selalu
 * ada di WHERE).
 */
export async function getSupplierProductStats(
  workspaceId: string,
  supplierId?: string,
): Promise<Map<string, SupplierProductStat[]>> {
  const rows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      imageUrl: productsTable.imageUrl,
      supplierId: productsTable.supplierId,
      totalSold: totalSoldSql,
      transactionCount: transactionCountSql,
      revenue: revenueSql,
    })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
    .where(
      and(
        isNotNull(productsTable.supplierId),
        // Tenant: hanya produk milik workspace ini.
        eq(storesTable.workspaceId, workspaceId),
        ...(supplierId ? [eq(productsTable.supplierId, supplierId)] : []),
      ),
    )
    .groupBy(productsTable.id)
    .orderBy(desc(revenueSql), asc(productsTable.name));

  const bySupplier = new Map<string, SupplierProductStat[]>();

  for (const row of rows) {
    if (!row.supplierId || !row.productId || !row.productName) continue;
    const current = bySupplier.get(row.supplierId) ?? [];
    current.push({
      id: row.productId,
      name: row.productName,
      imageUrl: row.imageUrl,
      totalSold: Number(row.totalSold) || 0,
      transactionCount: Number(row.transactionCount) || 0,
      revenue: Number(row.revenue) || 0,
    });
    bySupplier.set(row.supplierId, current);
  }

  return bySupplier;
}

/** Ringkasan seluruh produk satu suplier (dipakai daftar & halaman detail). */
export function summarizeSupplierProducts(
  products: SupplierProductStat[],
): SupplierProductSummary {
  return products.reduce<SupplierProductSummary>(
    (total, product) => ({
      productCount: total.productCount + 1,
      totalSold: total.totalSold + product.totalSold,
      transactionCount: total.transactionCount + product.transactionCount,
      revenue: total.revenue + product.revenue,
    }),
    { productCount: 0, totalSold: 0, transactionCount: 0, revenue: 0 },
  );
}
