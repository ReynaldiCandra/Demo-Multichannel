import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/db/schema';

/**
 * Test isolasi lintas-tenant (fase 3 multi-tenant).
 *
 * Skenario: dua workspace, A (1111…) dan B (2222…). Sesi test mengaku sebagai
 * user workspace A. Semua data milik B harus:
 *   - tidak muncul di daftar (GET),
 *   - tidak bisa dibaca per-ID (GET detail → 404),
 *   - tidak bisa diubah/dihapus (PATCH/DELETE → 404),
 *   - tidak bisa dijadikan referensi saat insert (storeId/host/klien → 404/400).
 *
 * ID tenant B dipilih BUKAN milik A → app wajib menjawab 404 (bukan 403,
 * jangan bocorkan keberadaan resource).
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

describe('Isolasi multi-tenant: workspace A tidak menyentuh data workspace B', () => {
  it('semua endpoint memfilter per workspace dan menolak ID tenant lain dengan 404', async () => {
    (globalThis as unknown as Holder).__testdb = db;

    // ── Setup skema + workspace A & B ──────────────────────────────────────
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

    // ── Data milik B (target serangan), dibuat langsung via db ─────────────
    const [storeB] = await db.insert(schema.storesTable).values({ workspaceId: WS_B, name: 'Toko B', channel: 'Shopee', feePercent: '8.00' }).returning();
    const [hostB] = await db.insert(schema.hostsTable).values({ workspaceId: WS_B, name: 'Host B' }).returning();
    const [jobB] = await db.insert(schema.jobsTable).values({ workspaceId: WS_B, clientName: 'Klien B', jobType: 'konveksi', startDate: '2026-09-01', contractValue: 1000000 }).returning();
    const [invoiceB] = await db.insert(schema.invoicesTable).values({ workspaceId: WS_B, invoiceNumber: 'INV-B-1', title: 'Invoice B', clientName: 'Klien B', issueDate: '2026-09-01', dueDate: '2026-09-30' }).returning();
    const [taskB] = await db.insert(schema.tasksTable).values({ workspaceId: WS_B, title: 'Tugas B', position: 1000 }).returning();
    const [supplierB] = await db.insert(schema.suppliersTable).values({ workspaceId: WS_B, name: 'Suplier B', whatsapp: '08111' }).returning();
    const [clientB] = await db.insert(schema.crmClientsTable).values({ workspaceId: WS_B, name: 'Klien CRM B' }).returning();
    const [metaB] = await db.insert(schema.metaAdTestsTable).values({ workspaceId: WS_B, productName: 'Iklan B', startDate: '2026-09-01', lastUpdated: '2026-09-01' }).returning();

    // ── Data milik A (konteks normal) ──────────────────────────────────────
    const [storeA] = await db.insert(schema.storesTable).values({ workspaceId: WS_A, name: 'Toko A', channel: 'TikTok', feePercent: '6.00' }).returning();

    // ── 1) Daftar (GET collection) hanya memuat milik A ────────────────────
    const listCases: Array<[string, Promise<Response>]> = [
      ['/api/stores', (await import('@/app/api/stores/route')).GET()],
      ['/api/hosts', (await import('@/app/api/hosts/route')).GET()],
      ['/api/jobs', (await import('@/app/api/jobs/route')).GET(jsonRequest('/api/jobs', 'GET'))],
      ['/api/invoices', (await import('@/app/api/invoices/route')).GET()],
      ['/api/tasks', (await import('@/app/api/tasks/route')).GET()],
      ['/api/suppliers', (await import('@/app/api/suppliers/route')).GET()],
      ['/api/crm/clients', (await import('@/app/api/crm/clients/route')).GET()],
      ['/api/meta-ads', (await import('@/app/api/meta-ads/route')).GET(jsonRequest('/api/meta-ads', 'GET'))],
    ];
    for (const [url, responsePromise] of listCases) {
      const res = await responsePromise;
      expect(res.status, url).toBe(200);
      const body = await res.json();
      const ids: string[] = Array.isArray(body) ? body.map((row: { id: string }) => row.id) : [];
      expect(ids, url).not.toContain(storeB.id);
      expect(ids, url).not.toContain(hostB.id);
      expect(ids, url).not.toContain(jobB.id);
      expect(ids, url).not.toContain(invoiceB.id);
      expect(ids, url).not.toContain(taskB.id);
      expect(ids, url).not.toContain(supplierB.id);
      expect(ids, url).not.toContain(clientB.id);
      expect(ids, url).not.toContain(metaB.id);
    }

    // ── 2) Detail per-ID milik B → 404 ─────────────────────────────────────
    const detailCases: Array<[string, Promise<Response>]> = [
      ['/api/stores/B', (await import('@/app/api/stores/[storeId]/route')).PATCH(jsonRequest('/x', 'PATCH', { name: 'Bajak' }), routeCtx({ storeId: storeB.id }))],
      ['/api/hosts/B', (await import('@/app/api/hosts/[hostId]/route')).PATCH(jsonRequest('/x', 'PATCH', { name: 'Bajak' }), routeCtx({ hostId: hostB.id }))],
      ['/api/jobs/B', (await import('@/app/api/jobs/[jobId]/route')).GET(jsonRequest('/x', 'GET'), routeCtx({ jobId: jobB.id }))],
      ['/api/invoices/B', (await import('@/app/api/invoices/[invoiceId]/route')).GET(jsonRequest('/x', 'GET'), routeCtx({ invoiceId: invoiceB.id }))],
      ['/api/tasks/B', (await import('@/app/api/tasks/[taskId]/route')).PATCH(jsonRequest('/x', 'PATCH', { title: 'bajak' }), routeCtx({ taskId: taskB.id }))],
      ['/api/suppliers/B', (await import('@/app/api/suppliers/[supplierId]/route')).PATCH(jsonRequest('/x', 'PATCH', { name: 'Bajak' }), routeCtx({ supplierId: supplierB.id }))],
      ['/api/crm/clients/B', (await import('@/app/api/crm/clients/[clientId]/route')).PATCH(jsonRequest('/x', 'PATCH', { name: 'Bajak' }), routeCtx({ clientId: clientB.id }))],
      ['/api/meta-ads/B', (await import('@/app/api/meta-ads/[metaAdTestId]/route')).PATCH(jsonRequest('/x', 'PATCH', { productName: 'Bajak' }), routeCtx({ metaAdTestId: metaB.id }))],
    ];
    for (const [label, responsePromise] of detailCases) {
      const res = await responsePromise;
      expect(res.status, label).toBe(404);
    }

    // ── 3) DELETE milik B → 404 dan data tetap ada ─────────────────────────
    const deleteCases: Array<[string, Promise<Response>]> = [
      ['/api/stores/B', (await import('@/app/api/stores/[storeId]/route')).DELETE(jsonRequest('/x', 'DELETE'), routeCtx({ storeId: storeB.id }))],
      ['/api/jobs/B', (await import('@/app/api/jobs/[jobId]/route')).DELETE(jsonRequest('/x', 'DELETE'), routeCtx({ jobId: jobB.id }))],
      ['/api/invoices/B', (await import('@/app/api/invoices/[invoiceId]/route')).DELETE(jsonRequest('/x', 'DELETE'), routeCtx({ invoiceId: invoiceB.id }))],
      ['/api/tasks/B', (await import('@/app/api/tasks/[taskId]/route')).DELETE(jsonRequest('/x', 'DELETE'), routeCtx({ taskId: taskB.id }))],
      ['/api/crm/clients/B', (await import('@/app/api/crm/clients/[clientId]/route')).DELETE(jsonRequest('/x', 'DELETE'), routeCtx({ clientId: clientB.id }))],
    ];
    for (const [label, responsePromise] of deleteCases) {
      const res = await responsePromise;
      expect(res.status, label).toBe(404);
    }
    // Bukti data B masih utuh (DELETE tidak sempat menyentuhnya).
    expect(await db.select().from(schema.storesTable)).toHaveLength(2);
    expect(await db.select().from(schema.jobsTable)).toHaveLength(1);
    expect(await db.select().from(schema.invoicesTable)).toHaveLength(1);

    // ── 4) Insert yang merujuk data B harus gagal ──────────────────────────
    // Produk menempel ke toko B → 404.
    const productsRoute = await import('@/app/api/products/route');
    expect(
      (await productsRoute.POST(jsonRequest('/x', 'POST', { storeId: storeB.id, name: 'Bajak', modal: 1, sellingPrice: 2 }))).status,
    ).toBe(404);

    // Sesi live dengan host B → 404.
    const liveRoute = await import('@/app/api/live-sessions/route');
    expect(
      (await liveRoute.POST(jsonRequest('/x', 'POST', { hostId: hostB.id, storeId: storeA.id, date: '2026-09-10', startTime: '19:00', endTime: '21:00', totalOrders: 0, totalRevenue: 0, totalComments: 0, commissionAmount: 0, commissionPaid: false }))).status,
    ).toBe(404);

    // Lead untuk klien B → 400 (klien tidak ditemukan di workspace A).
    const leadsRoute = await import('@/app/api/crm/leads/route');
    expect(
      (await leadsRoute.POST(jsonRequest('/x', 'POST', { clientId: clientB.id, name: 'Bajak', phone: '08123', source: 'tiktok', category: 'warm' }))).status,
    ).toBe(400);

    // Settlement untuk toko B → 404.
    const settlementRoute = await import('@/app/api/settlements/[storeId]/route');
    expect(
      (await settlementRoute.PATCH(jsonRequest('/x?month=2026-09', 'PATCH', { status: 'pending' }), routeCtx({ storeId: storeB.id }))).status,
    ).toBe(404);

    // ── 5) Laporan hanya menghitung data A ─────────────────────────────────
    const reportsStores = await import('@/app/api/reports/stores/route');
    const reportRes = await reportsStores.GET(jsonRequest('/api/reports/stores', 'GET'));
    const report = await reportRes.json();
    const reportStoreIds = report.stores.map((row: { storeId: string }) => row.storeId);
    expect(reportStoreIds).toEqual([storeA.id]); // toko B tidak ikut laporan

    // Dashboard kosong (tidak ada penjualan), tapi tidak error.
    const dashboard = await import('@/app/api/dashboard/route');
    expect((await dashboard.GET(jsonRequest('/api/dashboard', 'GET'))).status).toBe(200);
  });
});
