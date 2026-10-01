import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import bcrypt from 'bcryptjs';
import * as schema from '@/lib/db/schema';

/**
 * Hardening pra-beta (lihat roadmap-multi-tenant.md):
 *  1) Unit: fungsi rateLimit — jendela tetap, reset, kunci independen.
 *  2) Integrasi: endpoint login — 10 percobaan per email dalam 10 menit;
 *     percobaan ke-11 ditolak 429 WALAU password-nya benar.
 */

// ── Unit: rateLimit ─────────────────────────────────────────────────────────
describe('rateLimit (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mengizinkan sampai limit lalu menolak dengan Retry-After', async () => {
    const { rateLimit } = await import('@/lib/server/rate-limit');
    const key = `unit:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 1000)).toEqual({ ok: true });
    }
    const blocked = rateLimit(key, 3, 1000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('reset setelah jendela lewat dan kunci berbeda tidak saling mengganggu', async () => {
    const { rateLimit } = await import('@/lib/server/rate-limit');
    const keyA = `unit:${Math.random()}`;
    const keyB = `unit:${Math.random()}`;
    expect(rateLimit(keyA, 1, 1000)).toEqual({ ok: true });
    expect(rateLimit(keyA, 1, 1000).ok).toBe(false); // keyA habis
    expect(rateLimit(keyB, 1, 1000)).toEqual({ ok: true }); // keyB bebas

    vi.setSystemTime(new Date('2026-10-01T00:00:02Z')); // +2 detik > jendela 1s
    expect(rateLimit(keyA, 1, 1000)).toEqual({ ok: true }); // jendela baru
  });
});

// ── Integrasi: route login ──────────────────────────────────────────────────
const WS = '33333333-3333-3333-3333-333333333333';
const EMAIL = 'owner@ratelimit.test';
const PASSWORD_BENAR = 'password-benar-123';

const pg = new PGlite();
const db = drizzle(pg, { schema });
type Holder = { __testdb: typeof db };

vi.mock('@/lib/db', async () => {
  const s = await import('@/lib/db/schema');
  return { ...s, get db() { return (globalThis as unknown as Holder).__testdb; } };
});
// Cookie JWT butuh request scope Next.js + AUTH_SECRET — di test cukup stub.
vi.mock('@/lib/server/session', () => ({
  SESSION_COOKIE: 'dashboard_session',
  createSessionToken: async (user: { id: string }) => `test-token-${user.id}`,
  setSessionCookie: async () => {},
}));

const loginRequest = (password: string) =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify({ email: EMAIL, password }),
  });

describe('Rate-limit login (integrasi di Postgres in-memory)', () => {
  it('menolak percobaan ke-11 dengan 429 walau password benar', async () => {
    (globalThis as unknown as Holder).__testdb = db;

    // Skema + workspace + akun owner dengan password yang BENAR.
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    for (const file of readdirSync('supabase/migrations')
      .filter((name) => name.endsWith('.sql') && name !== '0000_init.sql')
      .sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await pg.exec(`insert into workspaces (id, name, slug) values ('${WS}', 'WS RL', 'ws-rl')`);
    await db.insert(schema.usersTable).values({
      email: EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD_BENAR, 10),
      name: 'Owner RL',
      role: 'owner',
      workspaceId: WS,
    });

    const { POST } = await import('@/app/api/auth/login/route');

    // Percobaan 1: login sukses (bukti kredensial benar & jalur normal jalan).
    const ok = await POST(loginRequest(PASSWORD_BENAR));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { user: { email: string } }).user.email).toBe(EMAIL);

    // Percobaan 2-10: password salah → 401 (pesan generik).
    for (let i = 0; i < 9; i++) {
      expect((await POST(loginRequest('password-salah'))).status, `salah #${i + 2}`).toBe(401);
    }

    // Percobaan 11: PASSWORD BENAR pun ditolak — limit per-email habis.
    const blocked = await POST(loginRequest(PASSWORD_BENAR));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect(((await blocked.json()) as { error: string }).error).toMatch(/Terlalu banyak/i);

    // Email lain dari IP yang sama masih boleh (limit per-email terpisah),
    // bukti kunci per-email dan per-IP bekerja independen pada hitungan wajar.
    const other = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: JSON.stringify({ email: 'orang-lain@ratelimit.test', password: PASSWORD_BENAR }),
      }),
    );
    expect(other.status).toBe(401); // user tidak ada → 401 biasa, bukan 429
  });
});
