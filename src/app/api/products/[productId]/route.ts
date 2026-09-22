import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable, suppliersTable } from '@/lib/db';
import {
  badRequest,
  conflict,
  handler,
  notFound,
  parsePatch,
  requireWriteAccess,
} from '@/lib/server/http';
import { ProductInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ productId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { productId } = await context.params;
  const parsed = await parsePatch(request, ProductInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const { targetMargin, supplierId, ...rest } = parsed.data;
  const supplier =
    supplierId === undefined || supplierId === null
      ? null
      : (
          await db
            .select({ name: suppliersTable.name, whatsapp: suppliersTable.whatsapp })
            .from(suppliersTable)
            .where(eq(suppliersTable.id, supplierId))
        )[0];
  const [product] = await db
    .update(productsTable)
    .set({
      ...rest,
      ...(supplierId === undefined
        ? {}
        : {
            supplierId,
            supplierName: supplier?.name ?? rest.supplierName ?? null,
            supplierPhone: supplier?.whatsapp ?? rest.supplierPhone ?? null,
          }),
      ...(targetMargin === undefined
        ? {}
        : { targetMargin: targetMargin === null ? null : String(targetMargin) }),
    })
    .where(eq(productsTable.id, productId))
    .returning();

  if (!product) return notFound('Produk tidak ditemukan');

  const [store] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, product.storeId));

  return NextResponse.json({
    ...product,
    storeName: store?.name ?? 'Toko',
    targetMargin: product.targetMargin == null ? null : Number(product.targetMargin),
  });
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { productId } = await context.params;
  const [{ total }] = await db
    .select({ total: count() })
    .from(salesTable)
    .where(eq(salesTable.productId, productId));

  if (total > 0) {
    return conflict('Produk sudah dipakai dalam penjualan. Nonaktifkan produk agar riwayat tetap aman.');
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, productId))
    .returning({ id: productsTable.id });

  if (!product) return notFound('Produk tidak ditemukan');
  return NextResponse.json({ ok: true });
});
