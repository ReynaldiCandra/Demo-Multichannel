import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import {
  autoPlatformFee,
  dateOnly,
  getSalesWithLabels,
  monthBounds,
} from '@/lib/server/dashboard';
import {
  badRequest,
  conflict,
  handler,
  notFound,
  parseBody,
  requireWriteAccess,
} from '@/lib/server/http';
import { SaleInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const month = params.get('month');
  const storeId = params.get('storeId');
  const status = params.get('status');

  const bounds = month && /^\d{4}-\d{2}$/.test(month) ? monthBounds(month) : null;
  const requestedLimit = Number(params.get('limit'));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 1000)
    : 200;

  // Filter dan batas baris dikerjakan database, bukan memuat semua transaksi lalu memfilter di server.
  const sales = await getSalesWithLabels({
    start: bounds?.start,
    end: bounds?.end,
    storeId: storeId ?? undefined,
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json(sales);
});

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, SaleInput);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  const [row] = await db
    .select({ product: productsTable, feePercent: storesTable.feePercent })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(eq(productsTable.id, input.productId));
  if (!row) return notFound('Produk tidak ditemukan');

  // Nomor pesanan yang sama untuk produk yang sama = kemungkinan input ganda.
  if (input.orderNumber) {
    const [duplicate] = await db
      .select({ id: salesTable.id })
      .from(salesTable)
      .where(
        and(
          eq(salesTable.orderNumber, input.orderNumber),
          eq(salesTable.productId, input.productId),
        ),
      )
      .limit(1);
    if (duplicate) {
      return conflict(
        `Pesanan ${input.orderNumber} untuk produk ini sudah tercatat. Edit transaksi yang ada, atau pakai nomor lain.`,
      );
    }
  }

  const platformFee =
    input.platformFee ??
    autoPlatformFee(row.feePercent, input.qty, input.actualPrice, input.discount);

  const [sale] = await db
    .insert(salesTable)
    .values({
      productId: input.productId,
      qty: input.qty,
      actualPrice: input.actualPrice,
      platformFee,
      discount: input.discount,
      saleDate: dateOnly(input.date)!,
      status: input.status,
      orderNumber: input.orderNumber,
      imageUrl: input.imageUrl ?? null,
      // Snapshot so later price edits never rewrite historical profit.
      modalSnapshot: row.product.modal,
    })
    .returning({ id: salesTable.id });

  const [created] = await getSalesWithLabels({ id: sale.id });
  return NextResponse.json(created, { status: 201 });
});
