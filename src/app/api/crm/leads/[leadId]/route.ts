import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, crmLeadsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { CrmLeadUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ leadId: string }> };

/**
 * PATCH /api/crm/leads/[leadId] — edit lead / pindah kategori pipeline.
 * closed_at diisi otomatis saat masuk kategori closing, dikosongkan saat keluar.
 */
export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { leadId } = await context.params;
  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'leadId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, CrmLeadUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [existing] = await db
    .select()
    .from(crmLeadsTable)
    .where(eq(crmLeadsTable.id, leadId))
    .limit(1);
  if (!existing) return notFound('Lead tidak ditemukan.');

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

/** DELETE /api/crm/leads/[leadId] — hapus lead. */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { leadId } = await context.params;
  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'leadId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(crmLeadsTable)
    .where(eq(crmLeadsTable.id, leadId))
    .returning();
  if (!deleted) return notFound('Lead tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
