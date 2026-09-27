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

const jsonRequest = (method: string, body: unknown) =>
  new Request('http://localhost/api/tasks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API kanban tugas: buat, pindah kolom, urutan, validasi, hapus', () => {
  it('berjalan end-to-end di Postgres in-memory', async () => {
    (globalThis as unknown as Holder).__testdb = db;
    const ddl = readFileSync('supabase/migrations/0000_init.sql', 'utf8')
      .split('--> statement-breakpoint').join('')
      .split(';').map((x) => x.trim()).filter((x) => x && !/ROW LEVEL SECURITY/.test(x));
    for (const stmt of ddl) await pg.exec(stmt);
    // Migration modul + tasks: 0009 berisi tabel tasks dan seed modul kanban.
    await pg.exec(readFileSync('supabase/migrations/0009_tasks.sql', 'utf8'));

    const { GET, POST } = await import('@/app/api/tasks/route');
    const { PATCH, DELETE } = await import('@/app/api/tasks/[taskId]/route');

    // 1) Buat tiga kartu di kolom todo.
    const a = await (await POST(jsonRequest('POST', { title: 'Balas email supplier' }))).json();
    const b = await (await POST(jsonRequest('POST', { title: 'Kirim invoice', priority: 'high', dueDate: '2026-10-05' }))).json();
    const c = await (await POST(jsonRequest('POST', { title: 'Rapikan gudang', priority: 'low' }))).json();

    // 2) Daftar terurut: kartu terbaru paling atas (position makin kecil).
    let list = await (await GET()).json();
    expect(list.map((t: { id: string }) => t.id)).toEqual([c.id, b.id, a.id]);
    expect(list[1].status).toBe('todo');
    expect(list[1].dueDate).toBe('2026-10-05');

    // 3) Pindah kartu B ke doing.
    await PATCH(jsonRequest('PATCH', { status: 'doing' }), {
      params: Promise.resolve({ taskId: b.id }),
    });
    list = await (await GET()).json();
    const doing = list.filter((t: { status: string }) => t.status === 'doing');
    expect(doing).toHaveLength(1);
    expect(doing[0].id).toBe(b.id);

    // 4) Pindah B ke done -> completed_at terisi; kembali ke todo -> kosong lagi.
    const doneRes = await (await PATCH(jsonRequest('PATCH', { status: 'done' }), {
      params: Promise.resolve({ taskId: b.id }),
    })).json();
    expect(doneRes.status).toBe('done');
    expect(doneRes.completedAt).toBeTruthy();
    const reverted = await (await PATCH(jsonRequest('PATCH', { status: 'todo' }), {
      params: Promise.resolve({ taskId: b.id }),
    })).json();
    expect(reverted.completedAt).toBeNull();

    // 5) Posisi: kartu baru selalu di paling atas kolom todo; drag & drop
    // menyisip lewat PATCH position di antara B dan A.
    const posB = list.find((t: { id: string }) => t.id === b.id).position as number;
    const posA = list.find((t: { id: string }) => t.id === a.id).position as number;
    await POST(jsonRequest('POST', { title: 'Tugas paling atas' }));
    let all = await (await GET()).json();
    expect(all[0].title).toBe('Tugas paling atas');
    const between = (posB + posA) / 2;
    await PATCH(jsonRequest('PATCH', { position: between }), {
      params: Promise.resolve({ taskId: c.id }),
    });
    all = await (await GET()).json();
    const todoOrder = all
      .filter((t: { status: string }) => t.status === 'todo')
      .map((t: { id: string }) => t.id);
    // C kini di antara B dan A.
    expect(todoOrder.indexOf(c.id)).toBeGreaterThan(todoOrder.indexOf(b.id));
    expect(todoOrder.indexOf(c.id)).toBeLessThan(todoOrder.indexOf(a.id));

    // 6) Validasi: judul kosong ditolak 400; taskId aneh ditolak 400.
    expect((await POST(jsonRequest('POST', { title: '   ' }))).status).toBe(400);
    expect(
      (
        await PATCH(jsonRequest('PATCH', { title: 'x' }), {
          params: Promise.resolve({ taskId: 'bukan-uuid' }),
        })
      ).status,
    ).toBe(400);

    // 7) Edit judul + prioritas.
    const edited = await (await PATCH(jsonRequest('PATCH', { title: 'Kirim invoice keBu Ratna', priority: 'low' }), {
      params: Promise.resolve({ taskId: b.id }),
    })).json();
    expect(edited.title).toBe('Kirim invoice keBu Ratna');
    expect(edited.priority).toBe('low');

    // 8) Hapus kartu C.
    expect(
      (await DELETE(new Request('http://localhost/x'), { params: Promise.resolve({ taskId: c.id }) })).status,
    ).toBe(200);
    list = await (await GET()).json();
    expect(list.find((t: { id: string }) => t.id === c.id)).toBeUndefined();
  });
});
