import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, crmClientsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { CrmProductUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ productId: string }> };

/** Produk milik workspace ini? Diverifikasi via klien pemiliknya. */
async function productOwnedByWorkspace(productId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: crmProductsTable.id })
    .from(crmProductsTable)
    .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
    .where(and(eq(crmProductsTable.id, productId), eq(crmClientsTable.workspaceId, workspaceId)))
    .limit(1);
  return Boolean(row);
}

/** PATCH — edit produk (pindah klien boleh, asal klien baru satu workspace). */
export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { productId } = await context.params;
  if (!UUID.test(productId)) {
    return NextResponse.json({ error: 'productId tidak valid' }, { status: 400 });
  }

  const exists = await productOwnedByWorkspace(productId, ctx.workspaceId);
  if (!exists) return notFound('Produk tidak ditemukan.');

  const parsed = await parseBody(request, CrmProductUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Klien baru wajib milik workspace yang sama.
  if (parsed.data.clientId) {
    const [client] = await db
      .select({ id: crmClientsTable.id })
      .from(crmClientsTable)
      .where(
        and(eq(crmClientsTable.id, parsed.data.clientId), eq(crmClientsTable.workspaceId, ctx.workspaceId)),
      )
      .limit(1);
    if (!client) return notFound('Klien tidak ditemukan.');
  }

  const [product] = await db
    .update(crmProductsTable)
    .set(parsed.data)
    .where(eq(crmProductsTable.id, productId))
    .returning();
  if (!product) return notFound('Produk tidak ditemukan.');

  return NextResponse.json(product);
});

/** DELETE — hapus produk milik workspace (leads tetap, product_id jadi NULL). */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { productId } = await context.params;
  if (!UUID.test(productId)) {
    return NextResponse.json({ error: 'productId tidak valid' }, { status: 400 });
  }

  const exists = await productOwnedByWorkspace(productId, ctx.workspaceId);
  if (!exists) return notFound('Produk tidak ditemukan.');

  await db.delete(crmProductsTable).where(eq(crmProductsTable.id, productId));
  return NextResponse.json({ ok: true });
});
