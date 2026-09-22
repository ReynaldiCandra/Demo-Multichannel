import { NextResponse } from 'next/server';
import {
  currentMonth,
  getPosTrendRows,
  getSalesWithLabels,
  monthBounds,
  monthKey,
} from '@/lib/server/dashboard';
import { handler } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

function shiftMonth(month: string, count: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 - count, 1)).toISOString().slice(0, 7);
}

const TREND_MONTHS = 6;

/**
 * Ringkasan dashboard: hanya penjualan toko (marketplace).
 * Data freelance ada di halaman Jobs, rincian toko di halaman Analisa Toko.
 */
export const GET = handler(async (request: Request) => {
  const month = new URL(request.url).searchParams.get('month') ?? currentMonth();
  const bounds = monthBounds(month);

  const [trendRows, recentSales] = await Promise.all([
    getPosTrendRows(shiftMonth(month, TREND_MONTHS - 1)),
    getSalesWithLabels({ start: bounds.start, end: bounds.end, status: 'selesai', limit: 5 }),
  ]);

  const current = trendRows.find((row) => monthKey(row.month) === month);

  // Tren enam bulan berurutan dari lama ke baru; bulan tanpa penjualan tetap tampil nol.
  const profitTrend = Array.from({ length: TREND_MONTHS }, (_, index) => {
    const key = shiftMonth(month, TREND_MONTHS - 1 - index);
    const row = trendRows.find((item) => monthKey(item.month) === key);
    return { month: `${key}-01`, posRevenue: row?.posRevenue ?? 0, posProfit: row?.posProfit ?? 0 };
  });

  return NextResponse.json({
    month,
    posRevenue: current?.posRevenue ?? 0,
    posProfit: current?.posProfit ?? 0,
    profitTrend,
    recentSales,
  });
});
