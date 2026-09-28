import { NextResponse } from 'next/server';
import { asc, count, eq } from 'drizzle-orm';
import { db, crmClientsTable, crmLeadsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { CrmClientInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/clients — daftar klien CRM + hitungan produk & leads.
 * Hitungan diambil dengan group-by terpisah lalu digabung di JS (bukan
 * subquery berkorelasi) supaya stabil di semua driver Postgres.
 */
export const GET = handler(async () => {
  const [clients, productCounts, leadCounts] = await Promise.all([
    db.select().from(crmClientsTable).orderBy(asc(crmClientsTable.name)),
    db
      .select({ clientId: crmProductsTable.clientId, total: count() })
      .from(crmProductsTable)
      .groupBy(crmProductsTable.clientId),
    db
      .select({ clientId: crmLeadsTable.clientId, total: count() })
      .from(crmLeadsTable)
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

/** POST /api/crm/clients — buat klien baru. */
export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, CrmClientInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db.insert(crmClientsTable).values(parsed.data).returning();
  return NextResponse.json(client, { status: 201 });
});
