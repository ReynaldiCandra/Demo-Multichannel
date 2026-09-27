import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import {
  db,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
} from '@/lib/db';
import { badRequest, conflict, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { InvoiceInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ invoiceId: string }> };

/**
 * GET /api/invoices/[invoiceId] — detail lengkap untuk halaman cetak:
 * field custom + item (amount dihitung server) + riwayat pembayaran.
 */
export const GET = handler(async (_request: Request, context: Context) => {
  const { invoiceId } = await context.params;
  if (!UUID.test(invoiceId)) {
    return NextResponse.json({ error: 'invoiceId tidak valid' }, { status: 400 });
  }

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1);
  if (!invoice) return notFound('Invoice tidak ditemukan.');

  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId))
    .orderBy(asc(invoiceItemsTable.position));

  const payments = await db
    .select()
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(asc(invoicePaymentsTable.paidAt));

  const detailItems = items.map((item) => {
    const qty = Number(item.qty) || 0;
    return { ...item, qty, amount: Math.round(qty * item.unitPrice) };
  });
  const total = detailItems.reduce((sum, item) => sum + item.amount, 0);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return NextResponse.json({
    ...invoice,
    total,
    paid,
    balance: total - paid,
    items: detailItems,
    payments,
  });
});

/**
 * PATCH /api/invoices/[invoiceId] — simpan editan penuh: field custom,
 * item (tambah/ubah/hapus/urut), dan pembayaran. Item & pembayaran yang
 * tidak ikut terkirim akan dihapus.
 */
export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { invoiceId } = await context.params;
  if (!UUID.test(invoiceId)) {
    return NextResponse.json({ error: 'invoiceId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, InvoiceInput);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  // Nomor invoice tidak boleh dipakai invoice lain (409 dengan pesan jelas).
  const [duplicate] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(eq(invoicesTable.invoiceNumber, input.invoiceNumber))
    .limit(1);
  if (duplicate && duplicate.id !== invoiceId) {
    return conflict(`Nomor invoice ${input.invoiceNumber} sudah dipakai invoice lain.`);
  }

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoicesTable)
        .set({
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
          updatedAt: new Date(),
        })
        .where(eq(invoicesTable.id, invoiceId))
        .returning();
      if (!updated) throw new Error('not_found');

      await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoiceId));
      await tx.insert(invoiceItemsTable).values(
        input.items.map((item, index) => ({
          invoiceId,
          position: index,
          description: item.description,
          qty: item.qty.toFixed(2),
          unitPrice: item.unitPrice,
        })),
      );

      await tx.delete(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, invoiceId));
      if (input.payments.length) {
        await tx.insert(invoicePaymentsTable).values(
          input.payments.map((payment) => ({
            invoiceId,
            paidAt: payment.paidAt,
            amount: payment.amount,
            label: payment.label,
          })),
        );
      }
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return conflict('Nomor invoice sudah dipakai invoice lain.');
    }
    if (error instanceof Error && error.message === 'not_found') {
      return notFound('Invoice tidak ditemukan.');
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
});

/** DELETE /api/invoices/[invoiceId] — hapus invoice beserta item & pembayaran. */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { invoiceId } = await context.params;
  if (!UUID.test(invoiceId)) {
    return NextResponse.json({ error: 'invoiceId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .returning();
  if (!deleted) return notFound('Invoice tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
