import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, crmClientsTable, crmLeadsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { CrmLeadUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ leadId: string }> };

/**
 * Patch/delete lead milik workspace ini? leads adalah tabel anak —
 * keanggotaan tenant diverifikasi via klien pemiliknya.
 */
async function leadOwnedByWorkspace(leadId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: crmLeadsTable.id })
    .from(crmLeadsTable)
    .innerJoin(crmClientsTable, eq(crmLeadsTable.clientId, crmClientsTable.id))
    .where(and(eq(crmLeadsTable.id, leadId), eq(crmClientsTable.workspaceId, workspaceId)))
    .limit(1);
  return Boolean(row);
}

/**
 * PATCH /api/crm/leads/[leadId] — edit lead / pindah kategori pipeline.
 * closed_at diisi otomatis saat masuk kategori closing, dikosongkan saat keluar.
 * Tenant: lead workspace lain → 404.
 */
export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { leadId } = await context.params;
  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'leadId tidak valid' }, { status: 400 });
  }

  const exists = await leadOwnedByWorkspace(leadId, ctx.workspaceId);
  if (!exists) return notFound('Lead tidak ditemukan.');

  const parsed = await parseBody(request, CrmLeadUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Jika pindah produk: produk baru wajib milik workspace yang sama.
  if (parsed.data.productId) {
    const [product] = await db
      .select({ id: crmProductsTable.id })
      .from(crmProductsTable)
      .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
      .where(
        and(eq(crmProductsTable.id, parsed.data.productId), eq(crmClientsTable.workspaceId, ctx.workspaceId)),
      )
      .limit(1);
    if (!product) return notFound('Produk tidak ditemukan.');
  }

  const [existing] = await db.select().from(crmLeadsTable).where(eq(crmLeadsTable.id, leadId)).limit(1);

  const input = parsed.data;
  const now = new Date();
  const wasClosing = existing.category === 'closing';
  const nextCategory = input.category ?? existing.category;

  const [lead] = await db
    .update(crmLeadsTable)
    .set({
      ...(input.productId !== undefined && { productId: input.productId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.followUpAt !== undefined && { followUpAt: input.followUpAt }),
      ...(input.category !== undefined && {
        closedAt: nextCategory === 'closing' ? (wasClosing ? existing.closedAt : now) : null,
      }),
      updatedAt: now,
    })
    .where(eq(crmLeadsTable.id, leadId))
    .returning();

  return NextResponse.json(lead);
});

/** DELETE /api/crm/leads/[leadId] — hapus lead milik workspace. */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { leadId } = await context.params;
  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'leadId tidak valid' }, { status: 400 });
  }

  const exists = await leadOwnedByWorkspace(leadId, ctx.workspaceId);
  if (!exists) return notFound('Lead tidak ditemukan.');

  await db.delete(crmLeadsTable).where(eq(crmLeadsTable.id, leadId));
  return NextResponse.json({ ok: true });
});
