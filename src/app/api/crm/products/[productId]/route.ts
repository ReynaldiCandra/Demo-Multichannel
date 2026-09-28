import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, crmProductsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { CrmProductUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ productId: string }> };

/** PATCH /api/crm/products/[productId] — edit produk (pindah klien boleh). */
export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { productId } = await context.params;
  if (!UUID.test(productId)) {
    return NextResponse.json({ error: 'productId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, CrmProductUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [product] = await db
    .update(crmProductsTable)
    .set(parsed.data)
    .where(eq(crmProductsTable.id, productId))
    .returning();
  if (!product) return notFound('Produk tidak ditemukan.');

  return NextResponse.json(product);
});

/** DELETE /api/crm/products/[productId] — hapus produk (leads tetap, product_id jadi NULL). */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { productId } = await context.params;
  if (!UUID.test(productId)) {
    return NextResponse.json({ error: 'productId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(crmProductsTable)
    .where(eq(crmProductsTable.id, productId))
    .returning();
  if (!deleted) return notFound('Produk tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
