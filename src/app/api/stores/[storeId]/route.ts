import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import {
  badRequest,
  conflict,
  handler,
  notFound,
  parsePatch,
  requireWriteAccess,
} from '@/lib/server/http';
import { StoreInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ storeId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { storeId } = await context.params;
  const parsed = await parsePatch(request, StoreInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const { feePercent, ...rest } = parsed.data;
  const [store] = await db
    .update(storesTable)
    .set({ ...rest, ...(feePercent === undefined ? {} : { feePercent: String(feePercent) }) })
    .where(eq(storesTable.id, storeId))
    .returning();

  if (!store) return notFound('Toko tidak ditemukan');
  const [usage] = await db
    .select({
      totalProducts: sql<string>`count(distinct ${productsTable.id})`,
      totalTransactions: sql<string>`count(distinct ${salesTable.id})`,
    })
    .from(storesTable)
    .leftJoin(productsTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
    .where(eq(storesTable.id, storeId));
  if (!usage) return notFound('Toko tidak ditemukan');
  const { totalProducts, totalTransactions } = usage;
  return NextResponse.json({
    ...store,
    feePercent: Number(store.feePercent) || 0,
    productCount: Number(totalProducts) || 0,
    transactionCount: Number(totalTransactions) || 0,
  });
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { storeId } = await context.params;
  const [usage] = await db
    .select({
      totalProducts: sql<string>`count(distinct ${productsTable.id})`,
      totalTransactions: sql<string>`count(distinct ${salesTable.id})`,
    })
    .from(storesTable)
    .leftJoin(productsTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
    .where(eq(storesTable.id, storeId));
  if (!usage) return notFound('Toko tidak ditemukan');
  const { totalProducts, totalTransactions } = usage;

  if (Number(totalProducts) > 0 || Number(totalTransactions) > 0) {
    return conflict(
      Number(totalTransactions) > 0
        ? 'Toko sudah memiliki transaksi. Arsipkan toko agar riwayat omzet tetap aman.'
        : 'Toko masih memiliki produk. Nonaktifkan toko atau hapus produknya terlebih dahulu.',
    );
  }

  const [store] = await db
    .delete(storesTable)
    .where(eq(storesTable.id, storeId))
    .returning({ id: storesTable.id });

  if (!store) return notFound('Toko tidak ditemukan');
  return NextResponse.json({ ok: true });
});
