import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';

/**
 * Test daftar & detail suplier saat satu suplier punya banyak produk.
 *
 * Yang diverifikasi:
 *   1. GET /api/suppliers hanya mengirim ringkasan (jumlah produk, pcs, omzet,
 *      transaksi) + maksimal 3 produk terlaris — bukan seluruh produk.
 *   2. Urutan produk = omzet menurun, jadi 3 teratas benar-benar terlaris.
 *   3. Omzet hanya dari transaksi "selesai" (batal tidak ikut).
 *   4. GET /api/suppliers/[supplierId] mengirim SELURUH produk suplier itu.
 *   5. Suplier tanpa produk tetap tampil dengan angka nol.
 *   6. Suplier workspace lain → 404 (tidak menebak keberadaannya).
 *   7. Bentuk response tulis: POST = Supplier penuh dengan angka nol (suplier
 *      baru memang belum punya produk); PATCH = SupplierRow saja, tanpa angka
 *      turunan yang bisa disalahartikan sebagai "suplier tanpa produk".
 */

const WS_A = '11111111-1111-1111-1111-111111111111';
const WS_B = '22222222-2222-2222-2222-222222222222';

const pg = new PGlite();
const db = drizzle(pg, { schema });
type Holder = { __testdb: typeof db };

vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as Holder).__testdb; } };
});
// Sesi = pemilik workspace A.
vi.mock('@/lib/server/session', () => ({
  getSession: async () => ({
    id: 'u1',
    email: 'a@x.id',
    name: 'Owner A',
    role: 'owner',
    workspaceId: WS_A,
  }),
}));

const jsonRequest = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const routeCtx = <T extends Record<string, string>>(params: T) => ({
  params: Promise.resolve(params),
});

describe('Suplier dengan banyak produk: daftar ringkas, detail lengkap', () => {
  it('membatasi daftar ke 3 produk terlaris + ringkasan, dan membuka semua produk di endpoint detail', async () => {
    (globalThis as unknown as Holder).__testdb = db;

    // ── Setup skema + dua workspace ───────────────────────────────────────
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    for (const file of readdirSync('supabase/migrations')
      .filter((name) => name.endsWith('.sql') && name !== '0000_init.sql')
      .sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await pg.exec(`insert into workspaces (id, name, slug) values ('${WS_A}', 'WS A', 'ws-a'), ('${WS_B}', 'WS B', 'ws-b')`);

    const [storeA] = await db.insert(schema.storesTable)
      .values({ workspaceId: WS_A, name: 'Toko A', channel: 'Shopee', feePercent: '0' }).returning();
    const [storeB] = await db.insert(schema.storesTable)
      .values({ workspaceId: WS_B, name: 'Toko B', channel: 'TikTok', feePercent: '0' }).returning();

    const [supplierMany] = await db.insert(schema.suppliersTable)
      .values({ workspaceId: WS_A, name: 'Suplier Banyak Produk', whatsapp: '0811' }).returning();
    const [supplierEmpty] = await db.insert(schema.suppliersTable)
      .values({ workspaceId: WS_A, name: 'Suplier Tanpa Produk', whatsapp: '0812' }).returning();
    const [supplierB] = await db.insert(schema.suppliersTable)
      .values({ workspaceId: WS_B, name: 'Suplier B', whatsapp: '0813' }).returning();

    // 5 produk milik suplier A — omzet sengaja dibuat tidak berurutan dengan nama.
    const productNames = ['Produk A', 'Produk B', 'Produk C', 'Produk D', 'Produk E'];
    const supplierProducts = [];
    for (const name of productNames) {
      const [product] = await db.insert(schema.productsTable)
        .values({ storeId: storeA.id, supplierId: supplierMany.id, name, modal: 100, sellingPrice: 200 })
        .returning();
      supplierProducts.push(product);
    }
    // Produk tanpa suplier: tidak boleh ikut hitungan suplier mana pun.
    await db.insert(schema.productsTable)
      .values({ storeId: storeA.id, name: 'Produk Tanpa Suplier', modal: 100, sellingPrice: 200 });
    // Produk milik workspace B (lewat suplier B) — harus tidak terlihat dari A.
    await db.insert(schema.productsTable)
      .values({ storeId: storeB.id, supplierId: supplierB.id, name: 'Produk B', modal: 1, sellingPrice: 2 });

    const [pA, pB, pC, pD, pE] = supplierProducts;
    await db.insert(schema.salesTable).values([
      // Omzet: 20.000 (2 pcs) — plus satu penjualan batal yang TIDAK dihitung.
      { productId: pA.id, qty: 2, actualPrice: 10000, modalSnapshot: 100, saleDate: '2026-09-01', status: 'selesai' },
      { productId: pA.id, qty: 9, actualPrice: 100000, modalSnapshot: 100, saleDate: '2026-09-02', status: 'batal' },
      // Omzet 50.000 (1 pcs) → terlaris menurut omzet.
      { productId: pB.id, qty: 1, actualPrice: 50000, modalSnapshot: 100, saleDate: '2026-09-03', status: 'selesai' },
      // Omzet 15.000 (5 pcs) — pcs terbanyak, omzet ketiga.
      { productId: pC.id, qty: 5, actualPrice: 3000, modalSnapshot: 100, saleDate: '2026-09-04', status: 'selesai' },
      // Omzet terkecil.
      { productId: pD.id, qty: 1, actualPrice: 1000, modalSnapshot: 100, saleDate: '2026-09-05', status: 'selesai' },
      // pE sengaja tanpa penjualan.
    ]);

    // ── 1–3) Daftar: ringkasan + maksimal 3 produk terlaris ───────────────
    const listRoute = await import('@/app/api/suppliers/route');
    const listRes = await listRoute.GET();
    expect(listRes.status).toBe(200);
    const list = await listRes.json();

    const many = list.find((row: { id: string }) => row.id === supplierMany.id);
    expect(many.productCount).toBe(5);
    expect(many.products).toHaveLength(3);
    expect(many.products.map((product: { name: string }) => product.name)).toEqual([
      'Produk B',
      'Produk A',
      'Produk C',
    ]);
    // Ringkasan dihitung dari SELURUH 5 produk, bukan hanya yang dikirim.
    expect(many.totalSold).toBe(9); // 2 + 1 + 5 + 1 + 0 — penjualan batal tidak ikut
    expect(many.transactionCount).toBe(4);
    expect(many.revenue).toBe(86000); // 50.000 + 20.000 + 15.000 + 1.000

    const empty = list.find((row: { id: string }) => row.id === supplierEmpty.id);
    expect(empty.productCount).toBe(0);
    expect(empty.products).toEqual([]);
    expect(empty.revenue).toBe(0);

    // Tenant lain tidak muncul sama sekali.
    expect(list.map((row: { id: string }) => row.id)).not.toContain(supplierB.id);

    // ── 4) Detail: seluruh produk suplier itu ─────────────────────────────
    const detailRoute = await import('@/app/api/suppliers/[supplierId]/route');
    const detailRes = await detailRoute.GET(
      new Request(`http://localhost/api/suppliers/${supplierMany.id}`),
      routeCtx({ supplierId: supplierMany.id }),
    );
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();

    expect(detail.id).toBe(supplierMany.id);
    expect(detail.productCount).toBe(5);
    expect(detail.products).toHaveLength(5);
    expect(detail.products.map((product: { name: string }) => product.name)).toEqual([
      'Produk B',
      'Produk A',
      'Produk C',
      'Produk D',
      'Produk E',
    ]);
    expect(detail.revenue).toBe(86000);
    // Produk tanpa suplier / milik tenant lain tidak boleh nyangkut.
    expect(detail.products.map((product: { name: string }) => product.name)).not.toContain(
      'Produk Tanpa Suplier',
    );

    // ── 5) Suplier tanpa produk tetap terbaca ─────────────────────────────
    const emptyRes = await detailRoute.GET(
      new Request(`http://localhost/api/suppliers/${supplierEmpty.id}`),
      routeCtx({ supplierId: supplierEmpty.id }),
    );
    expect(emptyRes.status).toBe(200);
    expect((await emptyRes.json()).products).toEqual([]);

    // ── 6) Suplier workspace lain → 404 ───────────────────────────────────
    const foreignRes = await detailRoute.GET(
      new Request(`http://localhost/api/suppliers/${supplierB.id}`),
      routeCtx({ supplierId: supplierB.id }),
    );
    expect(foreignRes.status).toBe(404);

    // ── 7) Bentuk response tulis (POST & PATCH) ───────────────────────────
    const createdRes = await listRoute.POST(
      jsonRequest('/api/suppliers', 'POST', {
        name: 'Suplier Baru',
        whatsapp: '0899',
        category: 'Kemasan',
        city: 'Bandung',
      }),
    );
    expect(createdRes.status).toBe(201);
    const created = await createdRes.json();
    // POST membalas bentuk Supplier penuh — angkanya nol karena belum ada produk.
    expect(created.productCount).toBe(0);
    expect(created.totalSold).toBe(0);
    expect(created.transactionCount).toBe(0);
    expect(created.revenue).toBe(0);
    expect(created.products).toEqual([]);

    // PATCH pada suplier yang PUNYA penjualan: balasannya tidak boleh mengklaim
    // angka — pemanggil harus membaca ulang GET untuk itu.
    const patchRes = await detailRoute.PATCH(
      jsonRequest(`/api/suppliers/${supplierMany.id}`, 'PATCH', { city: 'Surabaya' }),
      routeCtx({ supplierId: supplierMany.id }),
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.id).toBe(supplierMany.id);
    expect(patched.city).toBe('Surabaya');
    expect(patched.isActive).toBe(true);
    expect('productCount' in patched).toBe(false);
    expect('products' in patched).toBe(false);

    // Angka sebenarnya tetap utuh setelah PATCH (tidak ada yang ter-reset).
    const afterPatch = await (
      await detailRoute.GET(
        new Request(`http://localhost/api/suppliers/${supplierMany.id}`),
        routeCtx({ supplierId: supplierMany.id }),
      )
    ).json();
    expect(afterPatch.revenue).toBe(86000);
    expect(afterPatch.productCount).toBe(5);
  });
});
