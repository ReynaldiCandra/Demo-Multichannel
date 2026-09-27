import { NextResponse } from 'next/server';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, settlementsTable, storesTable } from '@/lib/db';
import { handler } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Batas atas bulan berikutnya untuk rentang tanggal [awal, akhir). */
function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
}

/**
 * GET /api/settlements?month=YYYY-MM
 *
 * Status pencairan dana marketplace per toko/kanal (Fase 5). Netto dihitung
 * live dari penjualan SELESAI bulan itu − biaya platform, sehingga selalu
 * konsisten dengan ledger. Toko tanpa transaksi tetap tampil dengan angka 0;
 * toko tanpa baris settlement dianggap `pending`.
 */
export const GET = handler(async (request: Request) => {
  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!MONTH.test(month)) {
    return NextResponse.json({ error: 'Format bulan harus YYYY-MM' }, { status: 400 });
  }

  const revenue = sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`;
  const platformFee = sql<string>`coalesce(sum(${salesTable.platformFee}), 0)`;

  const rows = await db
    .select({
      storeId: storesTable.id,
      storeName: storesTable.name,
      channel: storesTable.channel,
      revenue,
      platformFee,
      status: settlementsTable.status,
      releasedAmount: settlementsTable.releasedAmount,
      releasedDate: settlementsTable.releasedDate,
    })
    .from(storesTable)
    .leftJoin(
      productsTable,
      eq(productsTable.storeId, storesTable.id),
    )
    .leftJoin(
      salesTable,
      and(
        eq(salesTable.productId, productsTable.id),
        eq(salesTable.status, 'selesai'),
        gte(salesTable.saleDate, `${month}-01`),
        lt(salesTable.saleDate, nextMonthStart(month)),
      ),
    )
    .leftJoin(
      settlementsTable,
      and(eq(settlementsTable.storeId, storesTable.id), eq(settlementsTable.month, month)),
    )
    .groupBy(storesTable.id, settlementsTable.id)
    .orderBy(asc(storesTable.name), asc(storesTable.channel));

  return NextResponse.json(
    rows.map((row) => {
      const revenueNumber = Number(row.revenue) || 0;
      const feeNumber = Number(row.platformFee) || 0;
      return {
        storeId: row.storeId,
        storeName: row.storeName,
        channel: row.channel,
        month,
        revenue: revenueNumber,
        platformFee: feeNumber,
        expectedAmount: revenueNumber - feeNumber,
        status: row.status ?? 'pending',
        releasedAmount: row.releasedAmount ?? null,
        releasedDate: row.releasedDate ?? null,
      };
    }),
  );
});
