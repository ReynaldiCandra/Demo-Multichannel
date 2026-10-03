import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

/**
 * Test aksi massal (bulk actions).
 *
 * Yang diverifikasi:
 *   1. Bulk delete hanya menghapus data milik workspace sendiri (ID tenant
 *      lain diabaikan, bukan ikut terhapus).
 *   2. Produk yang punya riwayat penjualan dilewati (skipped), bukan 500.
 *   3. Suplier yang masih dipakai produk dilewati.
 *   4. Bulk PATCH kategori lead hanya menyentuh lead workspace sendiri.
 *   5. Payload tidak valid (ID acak / kosong) ditolak 400.
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

describe('Bulk actions: hapus & ubah status massal', () => {
  it('menghapus massal milik workspace sendiri, melewati yang terproteksi, dan menolak payload tidak valid', async () => {
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

    // ── Data workspace A ──────────────────────────────────────────────────
    const [storeA] = await db.insert(schema.storesTable).values({ workspaceId: WS_A, name: 'Toko A', channel: 'Shopee', feePercent: '0' }).returning();
    const [productFree] = await db.insert(schema.productsTable).values({ storeId: storeA.id, name: 'Produk bebas hapus', modal: 1000, sellingPrice: 2000 }).returning();
    const [productUsed] = await db.insert(schema.productsTable).values({ storeId: storeA.id, name: 'Produk terpakai', modal: 1000, sellingPrice: 2000 }).returning();
    await db.insert(schema.salesTable).values({ productId: productUsed.id, qty: 1, actualPrice: 2000, modalSnapshot: 1000, saleDate: '2026-09-01', status: 'selesai' });
    const [productOff] = await db.insert(schema.productsTable).values({ storeId: storeA.id, name: 'Produk arsip', modal: 500, sellingPrice: 900, isActive: false }).returning();

    const [supplierFree] = await db.insert(schema.suppliersTable).values({ workspaceId: WS_A, name: 'Suplier bebas', whatsapp: '0811' }).returning();
    const [supplierUsed] = await db.insert(schema.suppliersTable).values({ workspaceId: WS_A, name: 'Suplier terpakai', whatsapp: '0812' }).returning();
    await db.insert(schema.productsTable).values({ storeId: storeA.id, name: 'Produk pakai suplier', modal: 1, sellingPrice: 2, supplierId: supplierUsed.id });

    const [invoiceA1] = await db.insert(schema.invoicesTable).values({ workspaceId: WS_A, invoiceNumber: 'INV-A-1', title: 'A1', clientName: 'Klien A', issueDate: '2026-09-01' }).returning();
    const [invoiceA2] = await db.insert(schema.invoicesTable).values({ workspaceId: WS_A, invoiceNumber: 'INV-A-2', title: 'A2', clientName: 'Klien A', issueDate: '2026-09-02' }).returning();
    await db.insert(schema.invoiceItemsTable).values({ invoiceId: invoiceA1.id, position: 0, description: 'Item', qty: '1.00', unitPrice: 10000 });

    const [clientA] = await db.insert(schema.crmClientsTable).values({ workspaceId: WS_A, name: 'Klien CRM A' }).returning();
    const leadA1 = await db.insert(schema.crmLeadsTable).values({ clientId: clientA.id, name: 'Lead A1', source: 'meta', category: 'warm' }).returning();
    const leadA2 = await db.insert(schema.crmLeadsTable).values({ clientId: clientA.id, name: 'Lead A2', source: 'meta', category: 'hot' }).returning();

    // ── Data workspace B (harus tidak tersentuh) ──────────────────────────
    const [storeB] = await db.insert(schema.storesTable).values({ workspaceId: WS_B, name: 'Toko B', channel: 'TikTok', feePercent: '0' }).returning();
    const [productB] = await db.insert(schema.productsTable).values({ storeId: storeB.id, name: 'Produk B', modal: 1, sellingPrice: 2, isActive: false }).returning();
    const [supplierB] = await db.insert(schema.suppliersTable).values({ workspaceId: WS_B, name: 'Suplier B', whatsapp: '0813' }).returning();
    const [invoiceB] = await db.insert(schema.invoicesTable).values({ workspaceId: WS_B, invoiceNumber: 'INV-B-9', title: 'B', clientName: 'Klien B', issueDate: '2026-09-01' }).returning();
    const [clientB] = await db.insert(schema.crmClientsTable).values({ workspaceId: WS_B, name: 'Klien CRM B' }).returning();
    const [leadB] = await db.insert(schema.crmLeadsTable).values({ clientId: clientB.id, name: 'Lead B', source: 'meta', category: 'warm' }).returning();

    // ── 1) Bulk delete produk: milik A terhapus, milik B & terpakai dilewati ──
    const productsRoute = await import('@/app/api/products/route');
    const productBulkRes = await productsRoute.DELETE(
      jsonRequest('/api/products/bulk-delete', 'DELETE', { ids: [productFree.id, productUsed.id, productB.id] }),
    );
    expect(productBulkRes.status).toBe(200);
    const productBulk = (await productBulkRes.json()) as { deleted: string[]; skipped: string[] };
    expect(productBulk.deleted).toEqual([productFree.id]);
    expect(productBulk.skipped).toEqual([productUsed.id]); // punya riwayat sale
    expect(await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, productB.id))).toHaveLength(1);

    // ── 2) Bulk PATCH produk (aktif/nonaktif): hanya milik A yang berubah ──
    const patchRes = await productsRoute.PATCH(
      jsonRequest('/api/products/bulk-update', 'PATCH', { ids: [productOff.id, productB.id], isActive: true }),
    );
    expect(patchRes.status).toBe(200);
    const [productOffAfter] = await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, productOff.id));
    expect(productOffAfter.isActive).toBe(true);
    const [productBAfter] = await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, productB.id));
    expect(productBAfter.isActive).toBe(false); // milik B tidak tersentuh

    // ── 3) Bulk delete suplier: yang terpakai dilewati, milik B aman ──────
    const suppliersRoute = await import('@/app/api/suppliers/route');
    const supplierBulkRes = await suppliersRoute.DELETE(
      jsonRequest('/api/suppliers/bulk-delete', 'DELETE', { ids: [supplierFree.id, supplierUsed.id, supplierB.id] }),
    );
    expect(supplierBulkRes.status).toBe(200);
    const supplierBulk = (await supplierBulkRes.json()) as { deleted: string[]; skipped: string[] };
    expect(supplierBulk.deleted).toEqual([supplierFree.id]);
    expect(supplierBulk.skipped).toEqual([supplierUsed.id]);
    expect(await db.select().from(schema.suppliersTable).where(eq(schema.suppliersTable.id, supplierB.id))).toHaveLength(1);

    // ── 4) Bulk delete invoice: milik A terhapus (item ikut), B aman ──────
    const invoicesRoute = await import('@/app/api/invoices/route');
    const invoiceBulkRes = await invoicesRoute.DELETE(
      jsonRequest('/api/invoices/bulk-delete', 'DELETE', { ids: [invoiceA1.id, invoiceA2.id, invoiceB.id] }),
    );
    expect(invoiceBulkRes.status).toBe(200);
    const invoiceBulk = (await invoiceBulkRes.json()) as { deleted: string[] };
    expect(invoiceBulk.deleted.sort()).toEqual([invoiceA1.id, invoiceA2.id].sort());
    // Item ikut terhapus via cascade.
    expect(await db.select().from(schema.invoiceItemsTable).where(eq(schema.invoiceItemsTable.invoiceId, invoiceA1.id))).toHaveLength(0);
    expect(await db.select().from(schema.invoicesTable).where(eq(schema.invoicesTable.id, invoiceB.id))).toHaveLength(1);

    // ── 5) Bulk PATCH kategori lead: hanya lead milik A yang berubah ──────
    const leadsRoute = await import('@/app/api/crm/leads/route');
    const leadPatchRes = await leadsRoute.PATCH(
      jsonRequest('/api/crm/leads/bulk-update', 'PATCH', { ids: [leadA1[0].id, leadA2[0].id, leadB.id], category: 'closing' }),
    );
    expect(leadPatchRes.status).toBe(200);
    const leadPatch = (await leadPatchRes.json()) as { updated: string[] };
    expect(leadPatch.updated.sort()).toEqual([leadA1[0].id, leadA2[0].id].sort());
    const [leadA1After] = await db.select().from(schema.crmLeadsTable).where(eq(schema.crmLeadsTable.id, leadA1[0].id));
    expect(leadA1After.category).toBe('closing');
    expect(leadA1After.closedAt).not.toBeNull(); // closed_at terisi otomatis
    const [leadBAfter] = await db.select().from(schema.crmLeadsTable).where(eq(schema.crmLeadsTable.id, leadB.id));
    expect(leadBAfter.category).toBe('warm'); // milik B tidak tersentuh

    // Bulk delete lead: milik A terhapus, milik B tetap.
    const leadDeleteRes = await leadsRoute.DELETE(
      jsonRequest('/api/crm/leads/bulk-delete', 'DELETE', { ids: [leadA1[0].id, leadB.id] }),
    );
    expect(leadDeleteRes.status).toBe(200);
    const leadDelete = (await leadDeleteRes.json()) as { deleted: string[] };
    expect(leadDelete.deleted).toEqual([leadA1[0].id]);
    expect(await db.select().from(schema.crmLeadsTable).where(eq(schema.crmLeadsTable.id, leadB.id))).toHaveLength(1);

    // ── 6) Bulk delete klien CRM milik A: lead ikut cascade ───────────────
    const clientsRoute = await import('@/app/api/crm/clients/route');
    const clientBulkRes = await clientsRoute.DELETE(
      jsonRequest('/api/crm/clients/bulk-delete', 'DELETE', { ids: [clientA.id, clientB.id] }),
    );
    expect(clientBulkRes.status).toBe(200);
    const clientBulk = (await clientBulkRes.json()) as { deleted: string[] };
    expect(clientBulk.deleted).toEqual([clientA.id]);
    expect(await db.select().from(schema.crmLeadsTable).where(eq(schema.crmLeadsTable.id, leadA2[0].id))).toHaveLength(0);
    expect(await db.select().from(schema.crmClientsTable).where(eq(schema.crmClientsTable.id, clientB.id))).toHaveLength(1);

    // ── 7) Payload tidak valid ditolak 400 ────────────────────────────────
    const badBodies = [{ ids: [] }, { ids: ['bukan-uuid'] }, { ids: [storeA.id], isActive: 'ya' }];
    expect((await productsRoute.DELETE(jsonRequest('/x', 'DELETE', badBodies[0]))).status).toBe(400);
    expect((await productsRoute.DELETE(jsonRequest('/x', 'DELETE', badBodies[1]))).status).toBe(400);
    expect((await productsRoute.PATCH(jsonRequest('/x', 'PATCH', badBodies[2]))).status).toBe(400);
    expect((await leadsRoute.PATCH(jsonRequest('/x', 'PATCH', { ids: [storeA.id], category: 'kategoria-lain' }))).status).toBe(400);
  });
});
