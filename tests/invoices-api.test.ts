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
  getSession: async () => ({ id: 'u1', email: 'o@x.id', name: 'Owner', role: 'owner' }),
}));

const jsonRequest = (method: string, body: unknown) =>
  new Request('http://localhost/api/invoices', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API invoice custom: CRUD, item, pembayaran, status lunas', () => {
  it('menghitung total/paid/balance, menolak nomor ganda, dan sinkron saat PATCH', async () => {
    (globalThis as unknown as Holder).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    // Sisa migrasi berurutan (0001 dst.) — 0000 sudah lewat DDL terpisah di atas.
    // Dulu daftar dipilih manual dan sering tertinggal file baru.
    for (const file of readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql') && name !== '0000_init.sql').sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }

    const { GET, POST } = await import('@/app/api/invoices/route');
    const { GET: getOne, PATCH, DELETE } = await import('@/app/api/invoices/[invoiceId]/route');

    const body = {
      invoiceNumber: 'INV/2026/09/001',
      title: 'Invoice',
      clientName: 'Bu Ratna',
      clientAddress: 'Jl. Melati No. 3',
      issuerName: 'Exclusive Interior',
      issueDate: '2026-09-10',
      dueDate: '2026-09-30',
      description: 'Kitchen set dapur',
      scopeText: 'Pengukuran\nProduksi & pemasangan',
      logoUrl: null,
      notes: 'Transfer ke BCA 123456',
      items: [
        { description: 'Kitchen set atas', qty: 2.5, unitPrice: 1500000 },
        { description: 'Meja marmer', qty: 1, unitPrice: 4500000 },
      ],
      payments: [{ paidAt: '2026-09-11', amount: 3000000, label: 'DP 50%' }],
    };

    // 1) Create: subtotal 8.250.000, DP 3.000.000 -> sisa 5.250.000.
    const createRes = await POST(jsonRequest('POST', body));
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const invoiceId = created.id as string;

    const detailRes = await getOne(new Request('http://localhost/x'), {
      params: Promise.resolve({ invoiceId }),
    });
    const detail = await detailRes.json();
    expect(detail.total).toBe(8250000);
    expect(detail.paid).toBe(3000000);
    expect(detail.balance).toBe(5250000);
    expect(detail.items).toHaveLength(2);
    expect(detail.items[0].amount).toBe(3750000); // 2.5 x 1.500.000
    expect(detail.payments).toHaveLength(1);

    // 2) Daftar ringkas menampilkan angka yang sama.
    const list = await (await GET()).json();
    expect(list).toHaveLength(1);
    expect(list[0].total).toBe(8250000);
    expect(list[0].balance).toBe(5250000);

    // 3) Nomor ganda ditolak 409.
    const dupRes = await POST(jsonRequest('POST', body));
    expect(dupRes.status).toBe(409);

    // 4) PATCH pelunasan -> balance 0, dan item yang dihapus ikut hilang.
    // Total baru = 2.5 x 1.500.000 = 3.750.000; pelunasan = 3.750.000 - 3.000.000.
    const patchRes = await PATCH(
      jsonRequest('PATCH', {
        ...body,
        invoiceNumber: 'INV/2026/09/002',
        items: [body.items[0]],
        payments: [
          body.payments[0],
          { paidAt: '2026-09-20', amount: 750000, label: 'Pelunasan' },
        ],
      }),
      { params: Promise.resolve({ invoiceId }) },
    );
    expect(patchRes.status).toBe(200);

    const after = await (await getOne(new Request('http://localhost/x'), {
      params: Promise.resolve({ invoiceId }),
    })).json();
    expect(after.invoiceNumber).toBe('INV/2026/09/002');
    expect(after.items).toHaveLength(1);
    expect(after.paid).toBe(3750000);
    expect(after.balance).toBe(0);

    // 5) Validasi: tanpa item -> 400.
    const badRes = await POST(jsonRequest('POST', { ...body, invoiceNumber: 'X-1', items: [] }));
    expect(badRes.status).toBe(400);

    // 6) DELETE menghapus invoice beserta item & pembayaran.
    const delRes = await DELETE(new Request('http://localhost/x'), {
      params: Promise.resolve({ invoiceId }),
    });
    expect(delRes.status).toBe(200);
    const itemsLeft = await db.select().from(schema.invoiceItemsTable);
    expect(itemsLeft).toHaveLength(0);
    const paymentsLeft = await db.select().from(schema.invoicePaymentsTable);
    expect(paymentsLeft).toHaveLength(0);
  });
});
