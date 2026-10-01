import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, lte, or, sql, isNull } from 'drizzle-orm';
import { db, crmClientsTable, crmLeadsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { CRM_LEAD_CATEGORIES, CrmLeadCreateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/leads — daftar leads + filter + ringkasan pipeline.
 * Filter: clientId, productId, source, category, search (nama/HP/daerah),
 * due (1 = hanya yang follow-up-nya lewat/hari ini), limit.
 * `stats` = hitungan per kategori + daftar yang perlu follow-up.
 * Tenant: semua query difilter ke klien milik workspace (leads adalah tabel
 * anak dari crm_clients).
 */
export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const params = new URL(request.url).searchParams;
  const clientId = params.get('clientId');
  const productId = params.get('productId');
  const source = params.get('source');
  const category = params.get('category');
  const search = params.get('search')?.trim();
  const due = params.get('due') === '1';
  const limit = Math.min(Number(params.get('limit')) || 500, 1000);

  // Tenant: leads → klien, jadi cukup filter kolom workspace di crm_clients.
  const tenant = eq(crmClientsTable.workspaceId, ctx.workspaceId);

  const filters = [
    tenant,
    clientId ? eq(crmLeadsTable.clientId, clientId) : undefined,
    productId ? eq(crmLeadsTable.productId, productId) : undefined,
    source ? eq(crmLeadsTable.source, source) : undefined,
    category ? eq(crmLeadsTable.category, category) : undefined,
    due
      ? and(
          // Belum closing + tanggal follow-up lewat/hari ini (atau tak dijadwalkan > 7 hari).
          sql`${crmLeadsTable.category} <> 'closing'`,
          or(
            and(lte(crmLeadsTable.followUpAt, sql`current_date`)),
            isNull(crmLeadsTable.followUpAt),
          ),
        )
      : undefined,
    search
      ? or(
          sql`${crmLeadsTable.name} ilike ${'%' + search + '%'}`,
          sql`${crmLeadsTable.phone} ilike ${'%' + search + '%'}`,
          sql`${crmLeadsTable.region} ilike ${'%' + search + '%'}`,
        )
      : undefined,
  ].filter(Boolean);

  const where = and(...filters);

  const rows = await db
    .select({
      id: crmLeadsTable.id,
      clientId: crmLeadsTable.clientId,
      clientName: crmClientsTable.name,
      productId: crmLeadsTable.productId,
      productName: crmProductsTable.name,
      name: crmLeadsTable.name,
      phone: crmLeadsTable.phone,
      region: crmLeadsTable.region,
      source: crmLeadsTable.source,
      category: crmLeadsTable.category,
      notes: crmLeadsTable.notes,
      followUpAt: crmLeadsTable.followUpAt,
      closedAt: crmLeadsTable.closedAt,
      createdAt: crmLeadsTable.createdAt,
    })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .leftJoin(crmProductsTable, eq(crmLeadsTable.productId, crmProductsTable.id))
    .where(where)
    .orderBy(desc(crmLeadsTable.createdAt))
    .limit(limit);

  // Hitungan per kategori (tanpa filter kategori) untuk chip pipeline.
  const statsRows = await db
    .select({
      category: crmLeadsTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .where(
      and(
        tenant,
        clientId ? eq(crmLeadsTable.clientId, clientId) : undefined,
        productId ? eq(crmLeadsTable.productId, productId) : undefined,
        source ? eq(crmLeadsTable.source, source) : undefined,
      ),
    )
    .groupBy(crmLeadsTable.category);

  const counts = Object.fromEntries(
    CRM_LEAD_CATEGORIES.map((key) => [key, statsRows.find((row) => row.category === key)?.count ?? 0]),
  );

  // Daftar follow-up: belum closing & (tanggal lewat ATAU tidak dijadwalkan).
  const dueList = await db
    .select({
      id: crmLeadsTable.id,
      name: crmLeadsTable.name,
      clientName: crmClientsTable.name,
      followUpAt: crmLeadsTable.followUpAt,
      category: crmLeadsTable.category,
    })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .where(
      and(
        tenant,
        sql`${crmLeadsTable.category} <> 'closing'`,
        or(lte(crmLeadsTable.followUpAt, sql`current_date`), isNull(crmLeadsTable.followUpAt)),
        clientId ? eq(crmLeadsTable.clientId, clientId) : undefined,
      ),
    )
    .orderBy(sql`${crmLeadsTable.followUpAt} asc nulls first`)
    .limit(20);

  return NextResponse.json({ leads: rows, counts, due: dueList });
});

/** POST /api/crm/leads — catat lead baru (klien & produk wajib milik workspace). */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, CrmLeadCreateInput);
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

  if (parsed.data.productId) {
    const [product] = await db
      .select({ id: crmProductsTable.id })
      .from(crmProductsTable)
      .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
      .where(
        and(eq(crmProductsTable.id, parsed.data.productId), eq(crmClientsTable.workspaceId, ctx.workspaceId)),
      )
      .limit(1);
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 400 });
    }
  }

  const [lead] = await db
    .insert(crmLeadsTable)
    .values({
      clientId: parsed.data.clientId,
      productId: parsed.data.productId ?? null,
      name: parsed.data.name,
      phone: parsed.data.phone,
      region: parsed.data.region,
      source: parsed.data.source,
      category: parsed.data.category,
      notes: parsed.data.notes,
      followUpAt: parsed.data.followUpAt,
    })
    .returning();

  return NextResponse.json(lead, { status: 201 });
});

/** DELETE /api/crm/leads?ids=a,b,c — hapus massal (hanya lead milik workspace). */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const ids = new URL(request.url).searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  if (!ids.length) {
    return NextResponse.json({ error: 'Tidak ada lead yang dipilih.' }, { status: 400 });
  }
  if (ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  }

  // Saring dulu: hanya lead yang kliennya milik workspace ini yang boleh terhapus.
  const owned = await db
    .select({ id: crmLeadsTable.id })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .where(and(inArray(crmLeadsTable.id, ids), eq(crmClientsTable.workspaceId, ctx.workspaceId)));

  if (!owned.length) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const deleted = await db
    .delete(crmLeadsTable)
    .where(inArray(crmLeadsTable.id, owned.map((row) => row.id)))
    .returning({ id: crmLeadsTable.id });

  return NextResponse.json({ ok: true, deleted: deleted.length });
});
