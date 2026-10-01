import { NextResponse } from 'next/server';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db, crmClientsTable, crmLeadsTable } from '@/lib/db';
import { handler } from '@/lib/server/http';
import { isResponse, requireWorkspace } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/alerts — data untuk lonceng notifikasi (polling 30 detik).
 * Ringkasan follow-up jatuh tempo: belum closing DAN (tanggal lewat/hari ini
 * ATAU belum dijadwalkan). Jumlah kecil, murah, dan selalu segar.
 * Tenant: hanya leads lewat klien milik workspace ini.
 */
export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const rows = await db
    .select({
      id: crmLeadsTable.id,
      name: crmLeadsTable.name,
      phone: crmLeadsTable.phone,
      category: crmLeadsTable.category,
      followUpAt: crmLeadsTable.followUpAt,
      clientName: crmClientsTable.name,
    })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .where(
      and(
        eq(crmClientsTable.workspaceId, ctx.workspaceId),
        sql`${crmLeadsTable.category} <> 'closing'`,
        or(lte(crmLeadsTable.followUpAt, sql`current_date`), isNull(crmLeadsTable.followUpAt)),
      ),
    )
    .orderBy(sql`${crmLeadsTable.followUpAt} asc nulls first`)
    .limit(10);

  return NextResponse.json({
    count: rows.length,
    items: rows.map((row) => ({
      id: row.id,
      title: `Follow up: ${row.name}`,
      detail: `${row.clientName} · ${row.category}${row.followUpAt ? ` · ${row.followUpAt}` : ' · belum dijadwalkan'}`,
    })),
  });
});
