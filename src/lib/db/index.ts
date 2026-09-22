import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL belum di-set. Isi di .env.local (lokal) dan di Environment Variables Vercel (produksi).',
  );
}

// Serverless (Vercel) reuses the module across invocations, so cache the client
// on globalThis to avoid opening a new pool on every hot reload / invocation.
const globalForDb = globalThis as unknown as {
  __dashboardSql?: ReturnType<typeof postgres>;
};

// Jumlah koneksi per proses. Dulu `max: 1`, artinya SEMUA query dari SEMUA request
// (dashboard, laporan, modul, dst.) antre lewat satu koneksi. Kalau satu query
// tersangkut, seluruh dashboard ikut "loading" tanpa akhir.
// Lokal: 5. Serverless (Vercel): 3 per instance supaya pooler Supabase tidak penuh.
// Bisa diubah lewat DB_POOL_MAX di .env.local.
const poolMax = Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 5 : 8);

const client =
  globalForDb.__dashboardSql ??
  postgres(connectionString, {
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: poolMax,
    idle_timeout: 20,
    // Gagal cepat kalau koneksi tidak bisa dibuat, bukan menggantung berpuluh detik.
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    connection: {
      // Kalau satu query nyangkut (mis. lock atau tabel besar tanpa index),
      // dia gagal cepat dalam 15s dan MELEPAS koneksinya ke request lain —
      // bukan menggantung berpuluh detik/menit sambil menahan slot pool
      // yang kecil, yang dulu bikin SEMUA halaman lain ikut "loading" terus.
      statement_timeout: 15_000,
    },
  });

globalForDb.__dashboardSql = client;

export const sql = client;
export const db = drizzle(client, { schema });

export * from './schema';
