import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';

/**
 * Param `until` pada getStorePerformance (pembanding MTD banner insight):
 *  - batas akhir opsional EKSKLUSIF → saleDate < until,
 *  - diklem ke dalam batas bulan: format salah / di luar bulan diabaikan
 *    (perilaku tanpa `until` = bulan penuh, 100% tidak berubah).
 */

const WS = '44444444-4444-4444-4444-444444444444';

const pg = new PGlite();
const db = drizzle(pg, { schema });
type Holder = { __testdb: typeof db };

vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as Holder).__testdb; } };
});

describe('getStorePerformance dengan param until (MTD)', () => {
  it('membatasi rentang, mengabaikan param janggal, dan tetap hanya menghitung penjualan selesai', async () => {
    (globalThis as unknown as Holder).__testdb = db;

    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    for (const file of readdirSync('supabase/migrations')
      .filter((name) => name.endsWith('.sql') && name !== '0000_init.sql')
      .sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await pg.exec(`insert into workspaces (id, name, slug) values ('${WS}', 'WS MTD', 'ws-mtd')`);

    const [store] = await db
      .insert(schema.storesTable)
      .values({ workspaceId: WS, name: 'Toko MTD', channel: 'Shopee', feePercent: '0' })
      .returning();
    const [product] = await db
      .insert(schema.productsTable)
      .values({ storeId: store.id, name: 'Produk MTD', modal: 0, sellingPrice: 100000 })
      .returning();

    const sale = (date: string, qty: number, status = 'selesai') => ({
      productId: product.id,
      qty,
      actualPrice: 100000,
      modalSnapshot: 0,
      platformFee: 0,
      discount: 0,
      saleDate: date,
      status,
    });
    // Sep penuh = 100k + 200k + 100k = 400k; Okt terpisah; batal tidak dihitung.
    await db.insert(schema.salesTable).values([
      sale('2026-09-01', 1),
      sale('2026-09-15', 2),
      sale('2026-09-25', 1),
      sale('2026-10-01', 5),
      sale('2026-09-15', 9, 'batal'),
    ]);

    const { getStorePerformance } = await import('@/lib/server/reports');
    const revenueOf = async (until?: string) => {
      const report = await getStorePerformance('2026-09', WS, until);
      return report.totals.revenue;
    };

    // Tanpa until: bulan penuh (perilaku lama).
    expect(await revenueOf()).toBe(400_000);
    // until eksklusif: 1–15 Sep saja.
    expect(await revenueOf('2026-09-16')).toBe(300_000);
    // until = awal bulan berikutnya == batas bulan penuh.
    expect(await revenueOf('2026-10-01')).toBe(400_000);
    // until di luar bulan → diklem ke batas bulan (Okt tidak ikut).
    expect(await revenueOf('2026-10-05')).toBe(400_000);
    // until <= awal bulan → diabaikan (bukan rentang kosong).
    expect(await revenueOf('2026-09-01')).toBe(400_000);
    // Format salah → diabaikan.
    expect(await revenueOf('nonsense')).toBe(400_000);
    // Tanpa month (all-time): until tidak berpengaruh, penjualan selesai dihitung.
    const allTime = await getStorePerformance(undefined, WS, '2026-09-16');
    expect(allTime.totals.revenue).toBe(900_000); // termasuk Okt, tanpa batal
  });
});
