import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';

const pg = new PGlite();
const db = drizzle(pg, { schema });
type Holder = { __testdb: typeof db };

vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as Holder).__testdb; } };
});
vi.mock('@/lib/server/session', () => ({
  getSession: async () => ({ id: 'u1', email: 'o@x.id', name: 'Owner', role: 'owner' }),
}));

const jsonRequest = (method: string, body: unknown, query = '') =>
  new Request(`http://localhost/api/settlements${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API settlement: status pencairan per toko per bulan', () => {
  it('menghitung netto live, upsert status cair, dan validasi hybrid', async () => {
    (globalThis as unknown as Holder).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    for (const file of [
      '0002_sales_status_order_fee.sql',
      '0003_suppliers.sql',
      '0004_safe_reporting_indexes_and_suppliers.sql',
      '0005_product_supplier_image.sql',
      '0006_supplier_sale_image.sql',
      '0007_settlements.sql',
      '0012_live_and_store_media.sql',
    ]) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }

    const [store] = await db
      .insert(schema.storesTable)
      .values({ name: 'Rise & Wars', channel: 'Shopee', feePercent: '10.00' })
      .returning();
    const [product] = await db
      .insert(schema.productsTable)
      .values({ storeId: store.id, name: 'Kaos', modal: 30000, sellingPrice: 100000 })
      .returning();

    // Dua transaksi selesai + satu batal (harus dikecualikan).
    await db.insert(schema.salesTable).values([
      { productId: product.id, qty: 2, actualPrice: 100000, modalSnapshot: 30000, platformFee: 20000, discount: 0, saleDate: '2026-09-10', status: 'selesai' },
      { productId: product.id, qty: 1, actualPrice: 50000, modalSnapshot: 20000, platformFee: 5000, discount: 0, saleDate: '2026-09-20', status: 'selesai' },
      { productId: product.id, qty: 3, actualPrice: 80000, modalSnapshot: 30000, platformFee: 24000, discount: 0, saleDate: '2026-09-25', status: 'batal' },
    ]);

    const { GET } = await import('@/app/api/settlements/route');
    const { PATCH } = await import('@/app/api/settlements/[storeId]/route');

    // 1) Daftar: satu toko, netto live = 250.000 - 25.000 = 225.000, masih pending.
    const listRes = await GET(new Request('http://localhost/api/settlements?month=2026-09'));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].revenue).toBe(250000);
    expect(list[0].platformFee).toBe(25000);
    expect(list[0].expectedAmount).toBe(225000);
    expect(list[0].status).toBe('pending');
    expect(list[0].releasedAmount).toBeNull();

    // 2) Menandai cair tanpa nominal -> ditolak (aturan hybrid).
    const noAmount = await PATCH(
      jsonRequest('PATCH', { status: 'released' }, `?month=2026-09`),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(noAmount.status).toBe(400);

    // 3) Tandai cair dengan nominal riil (beda dari hitungan 225.000).
    const markRes = await PATCH(
      jsonRequest('PATCH', { status: 'released', releasedAmount: 220000, releasedDate: '2026-10-02' }, `?month=2026-09`),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(markRes.status).toBe(200);

    const after = await (await GET(new Request('http://localhost/api/settlements?month=2026-09'))).json();
    expect(after[0].status).toBe('released');
    expect(after[0].releasedAmount).toBe(220000);
    expect(after[0].releasedDate).toBe('2026-10-02');
    expect(after[0].expectedAmount).toBe(225000); // angka referensi tidak berubah

    // 4) Upsert kedua di bulan yang sama tidak membuat baris baru.
    const rows = await db.select().from(schema.settlementsTable);
    expect(rows).toHaveLength(1);

    // 5) Kembali pending -> nominal & tanggal cair di-reset.
    const revert = await PATCH(
      jsonRequest('PATCH', { status: 'pending' }, `?month=2026-09`),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(revert.status).toBe(200);
    const reset = await (await GET(new Request('http://localhost/api/settlements?month=2026-09'))).json();
    expect(reset[0].status).toBe('pending');
    expect(reset[0].releasedAmount).toBeNull();
    expect(reset[0].releasedDate).toBeNull();

    // 6) Bulan tidak valid -> 400.
    const badMonth = await GET(new Request('http://localhost/api/settlements?month=September'));
    expect(badMonth.status).toBe(400);
  });
});
