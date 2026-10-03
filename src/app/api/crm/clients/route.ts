import { NextResponse } from 'next/server';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db, crmClientsTable, crmLeadsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { BulkIdsInput, CrmClientInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/clients — daftar klien CRM milik workspace + hitungan produk
 * & leads. Hitungan diambil dengan group-by terpisah lalu digabung di JS
 * (bukan subquery berkorelasi) supaya stabil di semua driver Postgres.
 */
export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const tenant = eq(crmClientsTable.workspaceId, ctx.workspaceId);

  const [clients, productCounts, leadCounts] = await Promise.all([
    db.select().from(crmClientsTable).where(tenant).orderBy(asc(crmClientsTable.name)),
    db
      .select({ clientId: crmProductsTable.clientId, total: count() })
      .from(crmProductsTable)
      .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
      .where(tenant)
      .groupBy(crmProductsTable.clientId),
    db
      .select({ clientId: crmLeadsTable.clientId, total: count() })
      .from(crmLeadsTable)
      .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
      .where(tenant)
      .groupBy(crmLeadsTable.clientId),
  ]);

  const productsBy = new Map(productCounts.map((row) => [row.clientId, Number(row.total)]));
  const leadsBy = new Map(leadCounts.map((row) => [row.clientId, Number(row.total)]));

  return NextResponse.json(
    clients.map((client) => ({
      ...client,
      productCount: productsBy.get(client.id) ?? 0,
      leadCount: leadsBy.get(client.id) ?? 0,
    })),
  );
});

/** POST /api/crm/clients — buat klien baru di workspace ini. */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, CrmClientInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db
    .insert(crmClientsTable)
    .values({ ...parsed.data, workspaceId: ctx.workspaceId })
    .returning();
  return NextResponse.json(client, { status: 201 });
});

/**
 * DELETE /api/crm/clients — hapus massal klien milik workspace.
 * Produk & leads ikut terhapus lewat ON DELETE CASCADE.
 */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkIdsInput);
  if (!parsed.success) return badRequest(parsed.error);

  const deleted = await db
    .delete(crmClientsTable)
    .where(
      and(
        inArray(crmClientsTable.id, parsed.data.ids),
        eq(crmClientsTable.workspaceId, ctx.workspaceId),
      ),
    )
    .returning({ id: crmClientsTable.id });

  return NextResponse.json({ ok: true, deleted: deleted.map((row) => row.id) });
});
