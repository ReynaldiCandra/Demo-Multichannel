import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

/**
 * Test PATCH /api/auth/me (Pengaturan → Profil).
 *
 * Halaman Profil memakai endpoint ini untuk DUA aksi terpisah:
 *   - ganti/hapus foto  → body hanya `{ imageUrl }` (tanpa name)
 *   - simpan nama       → body hanya `{ name }`
 *
 * Bug yang dikunci di sini: `name` sempat diwajibkan, sehingga unggah foto
 * ditolak 400 "Data tidak valid" padahal uploadnya berhasil. Sekarang tiap
 * aksi boleh mengirim field-nya sendiri, tapi body kosong / nilai janggal
 * tetap ditolak 400.
 */

const WS = '11111111-1111-1111-1111-111111111111';
const USER_ID = '33333333-3333-3333-3333-333333333333';

const pg = new PGlite();
const db = drizzle(pg, { schema });
type Holder = { __testdb: typeof db };

vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as Holder).__testdb; } };
});
// Sesi = pemilik akun. Token/cookie di-stub: route menerbitkan ulang cookie
// sesi setiap kali profil berubah, dan itu di luar cakupan test ini.
vi.mock('@/lib/server/session', () => ({
  getSession: async () => ({
    id: USER_ID,
    email: 'owner@x.id',
    name: 'Nama Lama',
    role: 'owner',
    workspaceId: WS,
  }),
  createSessionToken: async () => 'token-baru',
  setSessionCookie: async () => undefined,
}));

const patch = async (body: unknown) => {
  const { PATCH } = await import('@/app/api/auth/me/route');
  const response = await PATCH(
    new Request('http://localhost/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
};

const userInDb = async () => {
  const [row] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, USER_ID));
  return row;
};

describe('PATCH /api/auth/me: profil sendiri', () => {
  it('menerima foto saja, nama saja, dan foto kosong — menolak body kosong / nilai janggal', async () => {
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
    await pg.exec(`insert into workspaces (id, name, slug) values ('${WS}', 'WS', 'ws')`);
    await db.insert(schema.usersTable).values({
      id: USER_ID,
      email: 'owner@x.id',
      passwordHash: 'x',
      name: 'Nama Lama',
      role: 'owner',
      workspaceId: WS,
    });

    // ── 1) Unggah foto: body hanya { imageUrl } — inilah yang dulu ditolak ──
    const photo = await patch({ imageUrl: 'https://blob.example.com/foto.webp' });
    expect(photo.status).toBe(200);
    expect(photo.body.user.imageUrl).toBe('https://blob.example.com/foto.webp');
    expect((await userInDb()).imageUrl).toBe('https://blob.example.com/foto.webp');
    // Nama tidak ikut berubah walau tidak dikirim.
    expect((await userInDb()).name).toBe('Nama Lama');

    // ── 2) Hapus foto: body hanya { imageUrl: null } ──────────────────────
    const removed = await patch({ imageUrl: null });
    expect(removed.status).toBe(200);
    expect((await userInDb()).imageUrl).toBeNull();

    // ── 3) Simpan nama saja (perilaku lama tetap jalan) ───────────────────
    const renamed = await patch({ name: 'Nama Baru' });
    expect(renamed.status).toBe(200);
    expect((await userInDb()).name).toBe('Nama Baru');

    // ── 4) Nama + foto sekaligus ──────────────────────────────────────────
    const both = await patch({ name: 'Nama Baru 2', imageUrl: 'https://blob.example.com/dua.webp' });
    expect(both.status).toBe(200);
    expect((await userInDb()).name).toBe('Nama Baru 2');
    expect((await userInDb()).imageUrl).toBe('https://blob.example.com/dua.webp');

    // ── 5) Yang tetap harus ditolak 400 ───────────────────────────────────
    const rejected: Array<[string, unknown]> = [
      ['body kosong', {}],
      ['nama kosong', { name: '' }],
      ['nama hanya spasi', { name: '   ' }],
      ['nama terlalu panjang', { name: 'x'.repeat(81) }],
      ['URL foto bukan URL', { imageUrl: 'bukan-url' }],
      ['URL foto bukan URL (bersama nama)', { name: 'Nama', imageUrl: 'bukan-url' }],
    ];
    for (const [label, body] of rejected) {
      const result = await patch(body);
      expect(result.status, label).toBe(400);
    }

    // Data terakhir tidak berubah oleh request yang ditolak.
    const final = await userInDb();
    expect(final.name).toBe('Nama Baru 2');
    expect(final.imageUrl).toBe('https://blob.example.com/dua.webp');
  });
});
