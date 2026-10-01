import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
  getSession: async () => ({
    id: 'u1',
    email: 'o@x.id',
    name: 'Owner',
    role: 'owner',
    workspaceId: '11111111-1111-1111-1111-111111111111',
  }),
}));

const jsonRequest = (method: string, body: unknown, url = 'http://localhost/api/crm') =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });

describe('API CRM: klien, produk, leads, pipeline, alerts', () => {
  it('berjalan end-to-end di Postgres in-memory', async () => {
    (globalThis as unknown as Holder).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    // Sisa migrasi berurutan (0001 dst.) — 0000 sudah lewat DDL terpisah di atas.
    for (const file of readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql') && name !== '0000_init.sql').sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    // Workspace milik sesi test (claim workspaceId di mock session).
    await pg.exec("insert into workspaces (id, name, slug) values ('11111111-1111-1111-1111-111111111111', 'WS Test', 'ws-test')");

    const clientsRoute = await import('@/app/api/crm/clients/route');
    const clientItemRoute = await import('@/app/api/crm/clients/[clientId]/route');
    const productsRoute = await import('@/app/api/crm/products/route');
    const productItemRoute = await import('@/app/api/crm/products/[productId]/route');
    const leadsRoute = await import('@/app/api/crm/leads/route');
    const leadItemRoute = await import('@/app/api/crm/leads/[leadId]/route');
    const alertsRoute = await import('@/app/api/crm/alerts/route');

    // 1) Buat klien.
    const client = await (
      await clientsRoute.POST(jsonRequest('POST', { name: 'Konveksi Amanah' }))
    ).json();
    expect(client.name).toBe('Konveksi Amanah');

    // 2) Buat produk milik klien.
    const product = await (
      await productsRoute.POST(
        jsonRequest('POST', { clientId: client.id, name: 'Kaos Polos Premium', price: 85000 }),
      )
    ).json();
    expect(product.clientId).toBe(client.id);

    // 3) Buat tiga leads dengan kategori berbeda.
    const leadHot = await (
      await leadsRoute.POST(
        jsonRequest('POST', {
          clientId: client.id,
          productId: product.id,
          name: 'Budi',
          phone: '6281234567890',
          region: 'Bandung',
          source: 'meta',
          category: 'hot',
          followUpAt: '2026-09-30',
        }),
      )
    ).json();
    const leadWarm = await (
      await leadsRoute.POST(
        jsonRequest('POST', { clientId: client.id, name: 'Sari', source: 'tiktok_ads', category: 'warm' }),
      )
    ).json();
    const leadDue = await (
      await leadsRoute.POST(
        jsonRequest('POST', { clientId: client.id, name: 'Anti', source: 'google', category: 'follow_up' }),
      )
    ).json();
    expect(leadHot.category).toBe('hot');
    expect(leadWarm.followUpAt).toBeNull();

    // 4) Daftar leads + stats: 3 leads, semua dihitung per kategori.
    const list = await (await leadsRoute.GET(jsonRequest('GET', null))).json();
    expect(list.leads).toHaveLength(3);
    expect(list.counts).toEqual({ hot: 1, warm: 1, closing: 0, follow_up: 1 });
    // Anti belum dijadwalkan follow-up -> masuk daftar due.
    expect(list.due.map((d: { id: string }) => d.id)).toContain(leadDue.id);

    // 5) Filter search "budi" (case-insensitive) + filter klien.
    const searched = await (
      await leadsRoute.GET(jsonRequest('GET', null, 'http://localhost/api/crm?search=budi'))
    ).json();
    expect(searched.leads).toHaveLength(1);
    expect(searched.leads[0].name).toBe('Budi');
    expect(searched.leads[0].productName).toBe('Kaos Polos Premium');

    // 6) Pindah kategori ke closing -> closed_at terisi; balik ke warm -> kosong.
    const closed = await (
      await leadItemRoute.PATCH(jsonRequest('PATCH', { category: 'closing' }), {
        params: Promise.resolve({ leadId: leadHot.id }),
      })
    ).json();
    expect(closed.category).toBe('closing');
    expect(closed.closedAt).toBeTruthy();
    const reverted = await (
      await leadItemRoute.PATCH(jsonRequest('PATCH', { category: 'warm' }), {
        params: Promise.resolve({ leadId: leadHot.id }),
      })
    ).json();
    expect(reverted.closedAt).toBeNull();

    // 7) Alerts: Anti (follow_up tanpa tanggal) muncul, Budi (warm, tidak due) tidak.
    const alerts = await (await alertsRoute.GET()).json();
    expect(alerts.count).toBeGreaterThanOrEqual(1);
    expect(alerts.items.some((i: { title: string }) => i.title.includes('Anti'))).toBe(true);

    // 8) Daftar klien memuat hitungan produk & leads.
    const clientList = await (await clientsRoute.GET()).json();
    expect(clientList[0].productCount).toBe(1);
    expect(clientList[0].leadCount).toBe(3);

    // 9) Validasi: lead tanpa nama ditolak.
    const invalid = await leadsRoute.POST(jsonRequest('POST', { clientId: client.id, name: '' }));
    expect(invalid.status).toBe(400);

    // 10) Hapus klien -> produk & leads ikut terhapus (cascade).
    await clientItemRoute.DELETE(jsonRequest('DELETE', null), {
      params: Promise.resolve({ clientId: client.id }),
    });
    const after = await (await leadsRoute.GET(jsonRequest('GET', null))).json();
    expect(after.leads).toHaveLength(0);
  });
});
