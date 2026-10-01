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
} from '@/lib/server/http';
import { requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
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
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { saleId } = await context.params;
  const parsed = await parsePatch(request, SaleInput.partial());
  if (!parsed.success) return badRequest(parsed.error);
  const patch = parsed.data;

  // Kepemilikan transaksi dicek lewat join ke stores (sales tanpa kolom workspace).
  const [current] = await db
    .select({ sale: salesTable })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(and(eq(salesTable.id, saleId), eq(storesTable.workspaceId, ctx.workspaceId)));
  if (!current) return notFound('Penjualan tidak ditemukan');
  const currentSale = current.sale;

  const productId = patch.productId ?? currentSale.productId;
  const [row] = await db
    .select({ product: productsTable, feePercent: storesTable.feePercent })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(
      and(eq(productsTable.id, productId), eq(storesTable.workspaceId, ctx.workspaceId)),
    );
  if (!row) return notFound('Produk tidak ditemukan');

  const qty = patch.qty ?? currentSale.qty;
  const actualPrice = patch.actualPrice ?? currentSale.actualPrice;
  const discount = patch.discount ?? currentSale.discount;
  const orderNumber = 'orderNumber' in patch ? (patch.orderNumber ?? null) : currentSale.orderNumber;
  const imageUrl = 'imageUrl' in patch ? (patch.imageUrl ?? null) : currentSale.imageUrl;

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
      : currentSale.platformFee;

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
      status: patch.status ?? currentSale.status,
      saleDate: patch.date ? dateOnly(patch.date)! : currentSale.saleDate,
      modalSnapshot: patch.productId ? row.product.modal : currentSale.modalSnapshot,
    })
    .where(eq(salesTable.id, saleId));

  const [updated] = await getSalesWithLabels({ id: saleId, workspaceId: ctx.workspaceId });
  return NextResponse.json(updated);
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { saleId } = await context.params;
  // Hapus hanya setelah baris terbukti milik workspace ini.
  const [owned] = await db
    .select({ id: salesTable.id })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(and(eq(salesTable.id, saleId), eq(storesTable.workspaceId, ctx.workspaceId)));
  if (!owned) return notFound('Penjualan tidak ditemukan');

  const [sale] = await db
    .delete(salesTable)
    .where(eq(salesTable.id, saleId))
    .returning({ id: salesTable.id });

  if (!sale) return notFound('Penjualan tidak ditemukan');
  return NextResponse.json({ ok: true });
});
