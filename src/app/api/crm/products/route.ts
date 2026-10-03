import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, crmClientsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { BulkIdsInput, CrmProductInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/products?clientId=... — daftar produk iklan per klien milik
 * workspace. Tanpa clientId: semua produk (dengan nama klien) untuk dropdown.
 */
export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const clientId = new URL(request.url).searchParams.get('clientId');
  const tenant = eq(crmClientsTable.workspaceId, ctx.workspaceId);

  const rows = await db
    .select({
      id: crmProductsTable.id,
      clientId: crmProductsTable.clientId,
      clientName: crmClientsTable.name,
      name: crmProductsTable.name,
      price: crmProductsTable.price,
      notes: crmProductsTable.notes,
    })
    .from(crmProductsTable)
    .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
    .where(
      clientId
        ? and(tenant, eq(crmProductsTable.clientId, clientId))
        : tenant,
    )
    .orderBy(asc(crmProductsTable.name));

  return NextResponse.json(rows);
});

/** POST /api/crm/products — buat produk iklan milik satu klien workspace ini. */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, CrmProductInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db
    .select({ id: crmClientsTable.id })
    .from(crmClientsTable)
    .where(
      and(eq(crmClientsTable.id, parsed.data.clientId), eq(crmClientsTable.workspaceId, ctx.workspaceId)),
    )
    .limit(1);
  if (!client) {
    return NextResponse.json({ error: 'Klien tidak ditemukan.' }, { status: 400 });
  }

  const [product] = await db
    .insert(crmProductsTable)
    .values({
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      price: parsed.data.price,
      notes: parsed.data.notes,
    })
    .returning();
  return NextResponse.json(product, { status: 201 });
});

/**
 * DELETE /api/crm/products — hapus massal produk iklan milik workspace.
 * Leads yang merujuk produk ini tetap aman (product_id jadi NULL).
 */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkIdsInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Saring ke workspace ini lewat klien pemiliknya.
  const owned = await db
    .select({ id: crmProductsTable.id })
    .from(crmProductsTable)
    .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
    .where(
      and(
        inArray(crmProductsTable.id, parsed.data.ids),
        eq(crmClientsTable.workspaceId, ctx.workspaceId),
      ),
    );
  if (!owned.length) {
    return NextResponse.json({ ok: true, deleted: [] });
  }

  const deleted = await db
    .delete(crmProductsTable)
    .where(inArray(crmProductsTable.id, owned.map((row) => row.id)))
    .returning({ id: crmProductsTable.id });

  return NextResponse.json({ ok: true, deleted: deleted.map((row) => row.id) });
});
