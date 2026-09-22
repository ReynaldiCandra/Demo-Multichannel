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

const json = (method: string, body: unknown) =>
  new Request('http://localhost/api/sales', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API penjualan: catat, edit, status, biaya otomatis, anti-ganda', () => {
  it('berjalan end-to-end di Postgres in-memory', async () => {
    (globalThis as unknown as Holder).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    await pg.exec(readFileSync('supabase/migrations/0002_sales_status_order_fee.sql', 'utf8'));

    const [store] = await db.insert(schema.storesTable).values({ name: 'Rise & Wars', channel: 'Shopee', feePercent: '8.00' }).returning();
    const [product] = await db.insert(schema.productsTable).values({ storeId: store.id, name: 'Kaos', modal: 50000, sellingPrice: 100000 }).returning();

    const { POST } = await import('@/app/api/sales/route');
    const { PATCH } = await import('@/app/api/sales/[saleId]/route');

    // 1) biaya platform kosong -> otomatis 8% dari omzet (2 x 100.000 - 10.000 = 190.000 -> 15.200)
    const created = await POST(json('POST', { productId: product.id, qty: 2, actualPrice: 100000, discount: 10000, date: '2026-09-10', orderNumber: 'SP-1' }));
    expect(created.status).toBe(201);
    const sale = await created.json();
    expect(sale.platformFee ?? sale.grossRevenue).toBeDefined();
    expect(sale.status).toBe('selesai');
    expect(sale.grossRevenue).toBe(190000);
    expect(sale.grossProfit).toBe(190000 - 100000 - 15200);

    // 2) nomor pesanan + produk yang sama ditolak (input ganda)
    const dup = await POST(json('POST', { productId: product.id, qty: 1, actualPrice: 100000, date: '2026-09-10', orderNumber: 'SP-1' }));
    expect(dup.status).toBe(409);

    // 3) ubah modal produk; edit qty TIDAK boleh mengubah snapshot modal, biaya ikut dihitung ulang
    await db.update(schema.productsTable).set({ modal: 70000 });
    const ctx = { params: Promise.resolve({ saleId: sale.id }) };
    const edited = await PATCH(json('PATCH', { qty: 3, platformFee: null }), ctx);
    expect(edited.status).toBe(200);
    const after = await edited.json();
    expect(after.qty).toBe(3);
    expect(after.modalSnapshot).toBe(50000);
    expect(after.grossRevenue).toBe(3 * 100000 - 10000);
    expect(after.grossProfit).toBe(290000 - 3 * 50000 - Math.round(290000 * 0.08));

    // 4) ubah status saja: field lain utuh
    const retur = await PATCH(json('PATCH', { status: 'retur' }), ctx);
    const r = await retur.json();
    expect(r.status).toBe('retur');
    expect(r.qty).toBe(3);
    expect(r.orderNumber).toBe('SP-1');

    // 5) biaya manual dihormati
    const manual = await PATCH(json('PATCH', { platformFee: 1234 }), ctx);
    const m = await manual.json();
    expect(m.grossProfit).toBe(290000 - 150000 - 1234);

    // 6) transaksi tak dikenal -> 404
    const missing = await PATCH(json('PATCH', { status: 'batal' }), { params: Promise.resolve({ saleId: '22222222-2222-4222-8222-222222222222' }) });
    expect(missing.status).toBe(404);
  });
});
