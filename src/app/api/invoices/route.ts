import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
} from '@/lib/db';
import { badRequest, conflict, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { BulkIdsInput, InvoiceInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices
 *
 * Daftar ringkas invoice custom (Fase 6) milik workspace + total tagihan dan
 * pembayaran, supaya sisa tagihan bisa dibaca langsung dari daftar.
 */
export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const invoiceRows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      title: invoicesTable.title,
      clientName: invoicesTable.clientName,
      issueDate: invoicesTable.issueDate,
      dueDate: invoicesTable.dueDate,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.workspaceId, ctx.workspaceId))
    .orderBy(desc(invoicesTable.issueDate), desc(invoicesTable.createdAt));

  const itemTotals = await db
    .select({
      invoiceId: invoiceItemsTable.invoiceId,
      total: sql<string>`coalesce(sum(${invoiceItemsTable.qty} * ${invoiceItemsTable.unitPrice}), 0)`,
    })
    .from(invoiceItemsTable)
    .groupBy(invoiceItemsTable.invoiceId);

  const paidTotals = await db
    .select({
      invoiceId: invoicePaymentsTable.invoiceId,
      paid: sql<string>`coalesce(sum(${invoicePaymentsTable.amount}), 0)`,
    })
    .from(invoicePaymentsTable)
    .groupBy(invoicePaymentsTable.invoiceId);

  const totalByInvoice = new Map(itemTotals.map((row) => [row.invoiceId, Number(row.total) || 0]));
  const paidByInvoice = new Map(paidTotals.map((row) => [row.invoiceId, Number(row.paid) || 0]));

  return NextResponse.json(
    invoiceRows.map((row) => {
      const total = totalByInvoice.get(row.id) ?? 0;
      const paid = paidByInvoice.get(row.id) ?? 0;
      return { ...row, total, paid, balance: total - paid };
    }),
  );
});

/**
 * POST /api/invoices — buat invoice baru beserta item & pembayaran awal.
 * Nomor invoice unik per workspace; duplikat ditolak dengan 409.
 */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, InvoiceInput);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  // Nomor invoice unik per workspace — cek eksplisit supaya pesannya jelas
  // (409), bukan 500 dari unique violation.
  const [duplicate] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.invoiceNumber, input.invoiceNumber),
        eq(invoicesTable.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  if (duplicate) {
    return conflict(`Nomor invoice ${input.invoiceNumber} sudah dipakai.`);
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoicesTable)
        .values({
          workspaceId: ctx.workspaceId,
          invoiceNumber: input.invoiceNumber,
          title: input.title,
          clientName: input.clientName,
          clientAddress: input.clientAddress,
          issuerName: input.issuerName,
          issuerAddress: input.issuerAddress,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          description: input.description,
          scopeText: input.scopeText,
          logoUrl: input.logoUrl ?? null,
          notes: input.notes,
        })
        .returning();

      if (input.items.length) {
        await tx.insert(invoiceItemsTable).values(
          input.items.map((item, index) => ({
            invoiceId: invoice.id,
            position: index,
            description: item.description,
            qty: item.qty.toFixed(2),
            unitPrice: item.unitPrice,
          })),
        );
      }

      if (input.payments.length) {
        await tx.insert(invoicePaymentsTable).values(
          input.payments.map((payment) => ({
            invoiceId: invoice.id,
            paidAt: payment.paidAt,
            amount: payment.amount,
            label: payment.label,
          })),
        );
      }

      return invoice;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // 23505 = unique_violation, pengaman kedua kalau ada race di antara
    // pre-check dan insert.
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return conflict('Nomor invoice sudah dipakai.');
    }
    throw error;
  }
});

/**
 * DELETE /api/invoices — hapus massal invoice milik workspace.
 * Item & pembayaran ikut terhapus via ON DELETE CASCADE.
 */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkIdsInput);
  if (!parsed.success) return badRequest(parsed.error);

  const deleted = await db
    .delete(invoicesTable)
    .where(
      and(
        inArray(invoicesTable.id, parsed.data.ids),
        eq(invoicesTable.workspaceId, ctx.workspaceId),
      ),
    )
    .returning({ id: invoicesTable.id });

  return NextResponse.json({ ok: true, deleted: deleted.map((row) => row.id) });
});
