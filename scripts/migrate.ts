/**
 * Menjalankan file migrasi SQL dari supabase/migrations ke database produksi.
 *
 * Pemakaian:
 *   npx tsx scripts/migrate.ts                      # jalankan semua yang belum tercatat
 *   npx tsx scripts/migrate.ts 0011_crm_leads.sql   # jalankan satu file tertentu
 *
 * - Koneksi memakai DIRECT_URL ?? DATABASE_URL (sama seperti db:seed).
 * - Aman diulang: file yang sudah sukses tercatat di tabel _migrations dan
 *   dilewati; file migrasi kita sendiri juga idempotent (IF NOT EXISTS).
 */
import { config } from 'dotenv';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL / DATABASE_URL belum diisi di .env.local / .env');
}

const client = postgres(connectionString, { prepare: false, max: 1 });

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function main() {
  // Tabel pelacak (bukan milik Drizzle, khusus runner ini).
  await client.unsafe(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    executed_at timestamptz NOT NULL DEFAULT now()
  )`);

  const done = new Set(
    (await client`SELECT name FROM _migrations`).map((row) => row.name as string),
  );

  // Meta folder punya struktur sendiri (drizzle journal) — dilewati.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const args = process.argv.slice(2);
  const targets = args.length ? files.filter((name) => args.includes(name)) : files;
  if (args.length) {
    const missing = args.filter((arg) => !files.includes(arg));
    if (missing.length) throw new Error(`File tidak ditemukan: ${missing.join(', ')}`);
  }

  const pending = targets.filter((name) => !done.has(name));
  if (!pending.length) {
    console.log('Tidak ada migrasi baru. Semua sudah tercatat:', [...done].sort().join(', ') || '(kosong)');
    return;
  }

  for (const name of pending) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
    process.stdout.write(`Menjalankan ${name} ... `);
    try {
      await client.begin(async (tx) => {
        await tx.unsafe(sqlText);
        await tx`INSERT INTO _migrations (name) VALUES (${name})`;
      });
      console.log('OK');
    } catch (error) {
      console.log('GAGAL');
      throw error;
    }
  }

  const verify = await client`SELECT name FROM _migrations ORDER BY name`;
  console.log('Selesai. Tercatat di _migrations:', verify.map((row) => row.name).join(', '));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
