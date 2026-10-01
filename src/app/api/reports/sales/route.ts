import { NextResponse } from 'next/server';
import { getSalesReport, type SalesReportSort } from '@/lib/server/reports';
import { PERIOD_PATTERN } from '@/lib/server/validation';
import { handler } from '@/lib/server/http';
import { isResponse, requireWorkspace } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORTS: SalesReportSort[] = ['pcs', 'revenue', 'profit', 'margin'];

/**
 * GET /api/reports/sales
 *   period  "YYYY-Www" (minggu ISO) | "YYYY-MM" | "YYYY", atau "all"/kosong
 *           untuk akumulasi seluruh waktu — menang atas `month`
 *   month   YYYY-MM (cara lama, tetap didukung)
 *   brand   nama brand (gabungan semua kanal)
 *   storeId satu kanal spesifik
 *   sort    pcs (terlaris) | revenue (omzet) | profit | margin
 * Tenant: hanya data lewat toko milik workspace ini.
 */
export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const params = new URL(request.url).searchParams;

  const rawPeriod = params.get('period');
  const period = rawPeriod && rawPeriod !== 'all' ? rawPeriod : null;
  if (period && !PERIOD_PATTERN.test(period)) {
    return NextResponse.json(
      { error: 'Format periode harus YYYY-Www, YYYY-MM, atau YYYY' },
      { status: 400 },
    );
  }

  const rawMonth = params.get('month');
  const month = rawMonth && rawMonth !== 'all' ? rawMonth : null;
  if (month && !MONTH.test(month)) {
    return NextResponse.json({ error: 'Format bulan harus YYYY-MM' }, { status: 400 });
  }

  const storeId = params.get('storeId');
  if (storeId && !UUID.test(storeId)) {
    return NextResponse.json({ error: 'storeId tidak valid' }, { status: 400 });
  }

  const rawSort = params.get('sort') as SalesReportSort | null;
  const sort = rawSort && SORTS.includes(rawSort) ? rawSort : 'pcs';

  const report = await getSalesReport({
    // Period menang atas month supaya dua filter tidak saling menimpa.
    month: period ? null : month,
    period,
    brand: params.get('brand') || null,
    storeId,
    sort,
    workspaceId: ctx.workspaceId,
  });

  return NextResponse.json(report);
});
