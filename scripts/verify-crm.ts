/**
 * Verifikasi hasil migrasi 0011_crm_leads.sql di database produksi:
 * kolom tiap tabel CRM, seed modul 'crm', status RLS, dan hitungan baris.
 * Jalankan: npx tsx scripts/verify-crm.ts
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL belum diisi di .env.local / .env');

const client = postgres(connectionString, { prepare: false, max: 1 });

async function main() {
  const tables = ['crm_clients', 'crm_products', 'crm_leads'];

  for (const table of tables) {
    const columns = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${table}
      ORDER BY ordinal_position`;
    console.log(`\n=== ${table} (${columns.length} kolom) ===`);
    for (const col of columns) {
      console.log(`  ${col.column_name} :: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    }

    const [{ total }] = await client`SELECT count(*)::int AS total FROM ${client(table)}`;
    console.log(`  -> ${total} baris`);
  }

  const [module] = await client`
    SELECT key, label, is_enabled, sort_order FROM modules WHERE key = 'crm'`;
  console.log(`\n=== Modul crm ===`);
  console.log(module ? `  ${module.key} (${module.label}) — enabled: ${module.is_enabled}, sort: ${module.sort_order}` : '  TIDAK ADA!');

  const rls = await client`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE tablename IN ('crm_clients', 'crm_products', 'crm_leads')
    ORDER BY tablename`;
  console.log(`\n=== RLS ===`);
  for (const row of rls) {
    console.log(`  ${row.tablename}: ${row.rowsecurity ? 'AKTIF' : 'MATI!'}`);
  }

  const [fk] = await client`
    SELECT count(*)::int AS total
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE 'crm_%'`;
  console.log(`\nForeign keys crm_*: ${fk.total}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
