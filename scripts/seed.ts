/**
 * Isi database dengan data awal: akun login, daftar modul, dan toko.
 * Jalankan sekali setelah migrasi: npm run db:seed
 *
 * Aman dijalankan berulang — bagian yang sudah terisi dilewati, bukan digandakan.
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import {
  hostsTable,
  jobCostsTable,
  jobPaymentsTable,
  jobsTable,
  liveSessionsTable,
  metaAdTestsTable,
  modulesTable,
  productsTable,
  salesTable,
  storesTable,
  usersTable,
} from '../src/lib/db/schema';

config({ path: '.env.local' });
config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL belum diisi di .env.local / .env');

const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

/** Daftar toko: satu brand bisa punya beberapa kanal. */
// feePercent hanya contoh awal. Sesuaikan dengan potongan sebenarnya di tiap
// marketplace (komisi + biaya layanan) lewat Produk & Stok → Toko.
const STORES = [
  { name: 'Exclusive Interior', channel: 'Shopee', feePercent: '8.00' },
  { name: 'Sora & Soul', channel: 'Shopee', feePercent: '8.00' },
  { name: 'Sora & Soul', channel: 'Lazada', feePercent: '7.00' },
  { name: 'Sora & Soul', channel: 'TikTok Shop', feePercent: '6.00' },
  { name: 'Rise & Wars', channel: 'Shopee', feePercent: '8.00' },
  { name: 'Fashionable Daily', channel: 'TikTok Shop', feePercent: '6.00' },
  { name: 'Websensial', channel: 'Etsy', feePercent: '6.50' },
];

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Ringkasan profit, tren, dan aktivitas terbaru.', isCore: true, sortOrder: 1 },
  { key: 'pos', label: 'POS & Penjualan', description: 'Catat penjualan harian, produk, dan toko.', isCore: false, sortOrder: 2 },
  { key: 'meta_ads', label: 'Meta Ads', description: 'Log manual tes iklan beserta CPL dan cost per closing.', isCore: false, sortOrder: 3 },
  { key: 'live', label: 'Live Selling', description: 'Sesi live, host, dan komisi.', isCore: false, sortOrder: 4 },
  { key: 'jobs', label: 'Jobs Freelance', description: 'Kontrak klien, biaya, pembayaran, dan deadline.', isCore: false, sortOrder: 5 },
  { key: 'laporan', label: 'Laporan & Ledger', description: 'Ledger profit bulanan dan laporan omzet per toko.', isCore: false, sortOrder: 6 },
];

async function seedUsers() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing.length) {
    console.log('• Akun sudah ada, dilewati.');
    return;
  }

  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? 'owner@websensial.com').toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'ubah-password-ini';
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'demo1234';

  await db.insert(usersTable).values([
    { email: ownerEmail, passwordHash: await bcrypt.hash(ownerPassword, 10), name: 'Owner', role: 'owner' },
    { email: 'demo@websensial.com', passwordHash: await bcrypt.hash(demoPassword, 10), name: 'Akun Demo', role: 'demo' },
  ]);

  console.log('• Akun dibuat:');
  console.log(`    owner : ${ownerEmail} / ${ownerPassword}`);
  console.log(`    demo  : demo@websensial.com / ${demoPassword}  (hanya bisa melihat)`);
}

async function seedModules() {
  const existing = await db.select({ key: modulesTable.key }).from(modulesTable).limit(1);
  if (existing.length) {
    console.log('• Modul sudah ada, dilewati.');
    return;
  }
  await db.insert(modulesTable).values(MODULES.map((m) => ({ ...m, isEnabled: true })));
  console.log(`• ${MODULES.length} modul didaftarkan.`);
}

async function seedStores() {
  await db.insert(storesTable).values(STORES).onConflictDoNothing();
  const stores = await db.select().from(storesTable);
  console.log(`• ${stores.length} toko siap digunakan.`);
  return stores;
}

async function seedSampleData(stores: Awaited<ReturnType<typeof seedStores>>) {
  if (!stores) return;
  if (process.env.SEED_SAMPLE_DATA === 'false') {
    console.log('• Data contoh dilewati (SEED_SAMPLE_DATA=false).');
    return;
  }
  const existingProducts = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
  if (existingProducts.length) {
    console.log('• Data contoh sudah ada, dilewati.');
    return;
  }

  const find = (name: string, channel: string) =>
    stores.find((store) => store.name === name && store.channel === channel)!;

  const products = await db
    .insert(productsTable)
    .values([
      { storeId: find('Sora & Soul', 'Shopee').id, name: 'Lilin Aromaterapi Cedar', modal: 42000, sellingPrice: 89000, supplierName: 'Supplier Rumah Wangi', supplierPhone: '081234567890' },
      { storeId: find('Sora & Soul', 'Lazada').id, name: 'Diffuser Keramik Mini', modal: 68000, sellingPrice: 129000, supplierName: 'Supplier Rumah Wangi', supplierPhone: '081234567890' },
      { storeId: find('Sora & Soul', 'TikTok Shop').id, name: 'Lilin Aromaterapi Cedar', modal: 42000, sellingPrice: 95000, supplierName: 'Supplier Rumah Wangi', supplierPhone: '081234567890' },
      { storeId: find('Exclusive Interior', 'Shopee').id, name: 'Rak Dinding Minimalis', modal: 115000, sellingPrice: 219000, supplierName: 'Gudang Interior', supplierPhone: '082345678901' },
      { storeId: find('Fashionable Daily', 'TikTok Shop').id, name: 'Tote Bag Kanvas', modal: 35000, sellingPrice: 79000, supplierName: 'Konveksi Harapan', supplierPhone: '083456789012' },
      { storeId: find('Websensial', 'Etsy').id, name: 'Template Notion Planner', modal: 0, sellingPrice: 145000 },
    ])
    .returning();

  await db.insert(salesTable).values([
    { productId: products[0].id, qty: 4, actualPrice: 89000, modalSnapshot: products[0].modal, platformFee: 13000, discount: 0, saleDate: today },
    { productId: products[1].id, qty: 2, actualPrice: 129000, modalSnapshot: products[1].modal, platformFee: 9000, discount: 5000, saleDate: today },
    { productId: products[2].id, qty: 6, actualPrice: 95000, modalSnapshot: products[2].modal, platformFee: 21000, discount: 10000, saleDate: today },
    { productId: products[3].id, qty: 1, actualPrice: 219000, modalSnapshot: products[3].modal, platformFee: 15000, discount: 0, saleDate: today },
    { productId: products[4].id, qty: 8, actualPrice: 79000, modalSnapshot: products[4].modal, platformFee: 19000, discount: 12000, saleDate: today },
    { productId: products[5].id, qty: 3, actualPrice: 145000, modalSnapshot: products[5].modal, platformFee: 22000, discount: 0, saleDate: today },
    // Contoh pesanan batal dan retur: tercatat, tetapi tidak dihitung sebagai omzet.
    { productId: products[0].id, qty: 2, actualPrice: 89000, modalSnapshot: products[0].modal, platformFee: 0, discount: 0, saleDate: today, status: 'batal', orderNumber: 'DEMO-0001' },
    { productId: products[4].id, qty: 1, actualPrice: 79000, modalSnapshot: products[4].modal, platformFee: 0, discount: 0, saleDate: today, status: 'retur', orderNumber: 'DEMO-0002' },
  ]);

  await db.insert(metaAdTestsTable).values([
    { productName: 'Lilin Aromaterapi Cedar', startDate: today, status: 'running', totalSpend: 485000, totalLeads: 37, totalClosing: 8, totalRevenue: 712000, notes: 'Creative video UGC masih paling stabil.', lastUpdated: today },
    { productName: 'Tote Bag Kanvas', startDate: today, status: 'completed', totalSpend: 920000, totalLeads: 44, totalClosing: 5, totalRevenue: 1095000, notes: 'Hentikan sementara, CPL terlalu tinggi.', lastUpdated: today },
  ]);

  const [job] = await db
    .insert(jobsTable)
    .values({ clientName: 'Nusantara Living', jobType: 'Meta Ads Management', startDate: today, deadline: today, status: 'running', contractValue: 3500000, notes: 'Optimasi campaign katalog dan retargeting.' })
    .returning();

  await db.insert(jobPaymentsTable).values({ jobId: job.id, paymentDate: today, amount: 1500000, type: 'down_payment' });
  await db.insert(jobCostsTable).values({ jobId: job.id, costDate: today, description: 'Budget testing campaign', amount: 250000 });

  const hosts = await db
    .insert(hostsTable)
    .values([
      { name: 'Alya', phone: '081298765432', commissionType: 'per_hour', rate: 75000 },
      { name: 'Nadia', phone: '081287654321', commissionType: 'percentage_revenue', rate: 5 },
    ])
    .returning();

  await db.insert(liveSessionsTable).values({
    hostId: hosts[0].id,
    storeId: find('Sora & Soul', 'TikTok Shop').id,
    sessionDate: today,
    startTime: '19:00',
    endTime: '21:00',
    totalOrders: 12,
    totalRevenue: 1380000,
    commissionAmount: 150000,
    commissionPaid: false,
    notes: 'Sesi live malam dengan fokus produk aromaterapi.',
  });

  console.log('• Data contoh dibuat.');
}

async function main() {
  await seedUsers();
  await seedModules();
  const stores = await seedStores();
  await seedSampleData(stores);
  console.log('\nSeed selesai.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
