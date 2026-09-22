import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import { autoPlatformFee, dateOnly, getSalesWithLabels } from '@/lib/server/dashboard';
import {
  badRequest,
  conflict,
  handler,
  notFound,
  parsePatch,
  requireWriteAccess,
} from '@/lib/server/http';
import { SaleInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ saleId: string }> };

/**
 * Edit sebagian transaksi (mis. hanya status, atau hanya qty).
 *
 * - `platformFee: null` = hitung ulang otomatis dari persentase toko.
 * - Modal (snapshot) TIDAK berubah saat edit, kecuali produknya diganti.
 */
export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { saleId } = await context.params;
  const parsed = await parsePatch(request, SaleInput.partial());
  if (!parsed.success) return badRequest(parsed.error);
  const patch = parsed.data;

  const [current] = await db.select().from(salesTable).where(eq(salesTable.id, saleId));
  if (!current) return notFound('Penjualan tidak ditemukan');

  const productId = patch.productId ?? current.productId;
  const [row] = await db
    .select({ product: productsTable, feePercent: storesTable.feePercent })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(eq(productsTable.id, productId));
  if (!row) return notFound('Produk tidak ditemukan');

  const qty = patch.qty ?? current.qty;
  const actualPrice = patch.actualPrice ?? current.actualPrice;
  const discount = patch.discount ?? current.discount;
  const orderNumber = 'orderNumber' in patch ? (patch.orderNumber ?? null) : current.orderNumber;
  const imageUrl = 'imageUrl' in patch ? (patch.imageUrl ?? null) : current.imageUrl;

  if (orderNumber) {
    const [duplicate] = await db
      .select({ id: salesTable.id })
      .from(salesTable)
      .where(
        and(
          eq(salesTable.orderNumber, orderNumber),
          eq(salesTable.productId, productId),
          ne(salesTable.id, saleId),
        ),
      )
      .limit(1);
    if (duplicate) {
      return conflict(`Pesanan ${orderNumber} untuk produk ini sudah tercatat di transaksi lain.`);
    }
  }

  const platformFee =
    'platformFee' in patch
      ? (patch.platformFee ?? autoPlatformFee(row.feePercent, qty, actualPrice, discount))
      : current.platformFee;

  await db
    .update(salesTable)
    .set({
      productId,
      qty,
      actualPrice,
      discount,
      platformFee,
      orderNumber,
      imageUrl,
      status: patch.status ?? current.status,
      saleDate: patch.date ? dateOnly(patch.date)! : current.saleDate,
      modalSnapshot: patch.productId ? row.product.modal : current.modalSnapshot,
    })
    .where(eq(salesTable.id, saleId));

  const [updated] = await getSalesWithLabels({ id: saleId });
  return NextResponse.json(updated);
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { saleId } = await context.params;
  const [sale] = await db
    .delete(salesTable)
    .where(eq(salesTable.id, saleId))
    .returning({ id: salesTable.id });

  if (!sale) return notFound('Penjualan tidak ditemukan');
  return NextResponse.json({ ok: true });
});
