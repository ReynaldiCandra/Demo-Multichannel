import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';

const pg = new PGlite();
const db = drizzle(pg, { schema });
vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as { __testdb: typeof db }).__testdb; } };
});

describe('laporan penjualan (SQL diuji di Postgres in-memory)', () => {
  it('menghitung omzet, HPP, profit, pcs, peringkat produk, ledger, dan total job', async () => {
    (globalThis as unknown as { __testdb: typeof db }).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map(x=>x.trim()).filter(x=>x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    await pg.exec(readFileSync('supabase/migrations/0002_sales_status_order_fee.sql', 'utf8'));
    // migrasi harus aman dijalankan dua kali
    await pg.exec(readFileSync('supabase/migrations/0002_sales_status_order_fee.sql', 'utf8'));
    const [a] = await db.insert(schema.storesTable).values({ name: 'Rise & Wars', channel: 'Shopee' }).returning();
    const [b] = await db.insert(schema.storesTable).values({ name: 'Rise & Wars', channel: 'TikTok' }).returning();
    const [c] = await db.insert(schema.storesTable).values({ name: 'Sora', channel: 'Shopee' }).returning();
    const [p1] = await db.insert(schema.productsTable).values({ storeId: a.id, name: 'Kaos', modal: 50000 }).returning();
    const [p2] = await db.insert(schema.productsTable).values({ storeId: b.id, name: 'Topi', modal: 20000 }).returning();
    const [p3] = await db.insert(schema.productsTable).values({ storeId: c.id, name: 'Tas', modal: 100000 }).returning();
    await db.insert(schema.salesTable).values([
      { productId: p1.id, qty: 3, actualPrice: 100000, modalSnapshot: 50000, platformFee: 5000, discount: 10000, saleDate: '2026-09-02' },
      { productId: p1.id, qty: 1, actualPrice: 100000, modalSnapshot: 50000, platformFee: 2000, discount: 0, saleDate: '2026-09-03' },
      { productId: p2.id, qty: 10, actualPrice: 40000, modalSnapshot: 20000, platformFee: 8000, discount: 0, saleDate: '2026-09-03' },
      { productId: p3.id, qty: 1, actualPrice: 250000, modalSnapshot: 100000, platformFee: 0, discount: 0, saleDate: '2026-08-15' },
    ]);
    // batal & retur dicatat tetapi tidak boleh masuk omzet/profit
    await db.insert(schema.salesTable).values([
      { productId: p2.id, qty: 5, actualPrice: 40000, modalSnapshot: 20000, platformFee: 4000, discount: 0, saleDate: '2026-09-04', status: 'batal', orderNumber: 'SP-001' },
      { productId: p1.id, qty: 2, actualPrice: 100000, modalSnapshot: 50000, platformFee: 3000, discount: 0, saleDate: '2026-09-04', status: 'retur', orderNumber: 'SP-002' },
    ]);
    const { getSalesReport, getStorePerformance } = await import('@/lib/server/reports');

    const brand = await getSalesReport({ month: '2026-09', brand: 'Rise & Wars' });
    expect(brand.totals.pcs).toBe(14);
    expect(brand.totals.revenue).toBe(290000 + 100000 + 400000);
    expect(brand.products[0].productName).toBe('Topi');
    const rev = await getSalesReport({ month: '2026-09', brand: 'Rise & Wars', sort: 'revenue' });
    expect(rev.products[0].productName).toBe('Topi');
    const all = await getSalesReport({ month: null });
    expect(all.totals.pcs).toBe(15);
    const one = await getSalesReport({ month: '2026-09', storeId: a.id });
    expect(one.totals.pcs).toBe(4);
    const perf = await getStorePerformance('2026-09');
    expect(perf.totals.hpp).toBe(3 * 50000 + 50000 + 200000);
    expect(brand.totals.profit).toBe(790000 - 400000 - 15000);
    expect(brand.channels).toHaveLength(2);
    expect(brand.excluded.batal).toEqual({ transactions: 1, pcs: 5, revenue: 200000 });
    expect(brand.excluded.retur).toEqual({ transactions: 1, pcs: 2, revenue: 200000 });
    expect((await getSalesReport({ month: '2026-09', brand: 'Sora' })).excluded.batal.transactions).toBe(0);
    expect(brand.daily.map((d) => d.date)).toEqual(['2026-09-02', '2026-09-03']);

    // ledger per bulan + total job dihitung di database
    const [job] = await db.insert(schema.jobsTable).values({ clientName: 'X', jobType: 'Ads', startDate: '2026-09-01', contractValue: 1000000 }).returning();
    await db.insert(schema.jobPaymentsTable).values({ jobId: job.id, paymentDate: '2026-09-05', amount: 400000, type: 'dp' });
    await db.insert(schema.jobCostsTable).values({ jobId: job.id, costDate: '2026-09-06', description: 'iklan', amount: 100000 });
    const { getLedgerRows, getJobTotals, autoPlatformFee } = await import('@/lib/server/dashboard');
    const ledger = await getLedgerRows();
    expect(ledger.map((r) => r.month)).toEqual(['2026-09-01', '2026-08-01']);
    expect(ledger[0].jobProfit).toBe(300000);
    expect(ledger[0].posProfit).toBe(375000);
    expect((await getLedgerRows('2026-09')).length).toBe(1);
    expect(ledger[0].posRevenue).toBe(790000); // batal/retur tidak ikut
    expect(autoPlatformFee('8.00', 2, 100000, 10000)).toBe(15200);
    expect(autoPlatformFee(0, 2, 100000, 0)).toBe(0);
    // endpoint dashboard: hanya penjualan toko, tren 6 bulan berurutan (bulan kosong = 0)
    const { GET } = await import('@/app/api/dashboard/route');
    const dash = await (await GET(new Request('http://x/api/dashboard?month=2026-09'))).json();
    expect(dash.posRevenue).toBe(790000);
    expect(dash.posProfit).toBe(375000);
    expect(dash.profitTrend.map((p: { month: string }) => p.month.slice(0, 7))).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(dash.profitTrend[4].posProfit).toBe(150000); // Agustus: 250.000 - 100.000
    expect(dash.profitTrend[0].posProfit).toBe(0);
    expect(dash.recentSales.length).toBeLessThanOrEqual(5);
    expect(dash.netProfit).toBeUndefined();
    const jobs = await getJobTotals();
    expect(jobs[0].totalPaid).toBe(400000);
    expect(jobs[0].totalCost).toBe(100000);
  });
});
