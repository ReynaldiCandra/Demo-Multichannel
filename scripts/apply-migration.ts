/**
 * Menerapkan SATU file migrasi dari supabase/migrations ke database produksi:
 *   npx tsx scripts/apply-migration.ts 0017_user_profile_image.sql
 *
 * Perlu karena tabel _migrations di database ini belum pernah diisi runner
 * biasa (migrate.ts tidak bisa bunuh ulang file lama 0000–0015 yang sudah
 * statusnya lolos). File idempotent boleh dijalankan ulang; setelah sukses
 * dicatat di _migrations supaya runner/migrasi tak diulang.
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const connectionString: string = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL tidak ada');

const arg = process.argv[2];
if (!arg || !arg.endsWith('.sql')) {
  console.error('Pemakaian: npx tsx scripts/apply-migration.ts <nama-file>.sql');
  process.exit(1);
}
const name: string = arg;

async function main() {
  const client = postgres(connectionString, { prepare: false, max: 1 });
  const sqlText = readFileSync(join(process.cwd(), 'supabase', 'migrations', name), 'utf8');
  try {
    await client.begin(async (tx) => {
      await tx.unsafe(`CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        executed_at timestamptz NOT NULL DEFAULT now()
      )`);
      const [done] = await tx`SELECT 1 FROM _migrations WHERE name = ${name}`;
      if (done) {
        console.log(`SKIP — ${name} sudah tercatat di _migrations`);
        return;
      }
      await tx.unsafe(sqlText);
      await tx`INSERT INTO _migrations (name) VALUES (${name})`;
      console.log(`OK — ${name} diterapkan & tercatat di _migrations`);
    });
  } catch (error) {
    console.error('GAGAL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
