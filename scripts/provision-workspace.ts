/**
 * Provision satu workspace baru lengkap dengan akun owner + demo + data contoh.
 * Dipakai untuk onboarding manual calon pelanggan di masa pra-beta (fase 4-5
 * multi-tenant ditunda sampai hasil beta).
 *
 * Pemakaian:
 *   npm run provision -- --name "Toko Jaya" --email owner@tokojaya.id
 *   Opsi:
 *     --password <pw>        password owner (default: dibuat acak & dicetak)
 *     --demo-password <pw>   password akun demo (default: demo1234)
 *     --owner-name <nama>    nama pemilik (default: "Owner")
 *     --plan free|trial      plan awal (default: trial, 14 hari)
 *     --no-demo              jangan buat akun demo
 *     --no-sample            jangan isi data contoh
 *
 * Semua insert berjalan dalam SATU transaksi: gagal di tengah = tidak ada
 * sisa data yatim. Data contoh dibuat generik (bukan data Websensial) supaya
 * aman ditunjukkan ke calon pelanggan mana pun.
 */
import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import {
  crmClientsTable,
  crmLeadsTable,
  crmProductsTable,
  hostsTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  invoicesTable,
  jobCostsTable,
  jobPaymentsTable,
  jobsTable,
  liveSessionsTable,
  metaAdTestsTable,
  productsTable,
  salesTable,
  storesTable,
  suppliersTable,
  tasksTable,
  usersTable,
  workspacesTable,
} from '../src/lib/db/schema';

config({ path: '.env.local' });
config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL belum diisi di .env.local / .env');

const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client);

// ── Argumen CLI ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (flag: string) => {
  const i = args.indexOf(`--${flag}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (flag: string) => args.includes(`--${flag}`);

const workspaceName = arg('name');
const ownerEmail = arg('email')?.trim().toLowerCase();
const ownerPassword = arg('password') ?? randomBytes(9).toString('base64url');
const demoPassword = arg('demo-password') ?? 'demo1234';
const ownerName = arg('owner-name') ?? 'Owner';
const plan = arg('plan') ?? 'trial';

if (!workspaceName || !ownerEmail || !/.+@.+\..+/.test(ownerEmail)) {
  console.error('Pemakaian: npm run provision -- --name "Nama Usaha" --email owner@domain.id [--password ...] [--no-demo] [--no-sample]');
  process.exit(1);
}
if (plan !== 'free' && plan !== 'trial') {
  console.error('--plan hanya boleh "free" atau "trial".');
  process.exit(1);
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

/** Tanggal (YYYY-MM-DD, zona Jakarta) sejak `offset` hari lalu. */
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
    new Date(Date.now() - offset * 86_400_000),
  );

async function main() {
  const slug = slugify(workspaceName!);

  // Pra-cek biar error-nya manusiawi, bukan pelanggaran unique dari Postgres.
  const [emailTaken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${ownerEmail}`);
  if (emailTaken) {
    console.error(`Email ${ownerEmail} sudah terdaftar. Gunakan email lain.`);
    process.exit(1);
  }

  const [slugTaken] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.slug, slug));
  const finalSlug = slugTaken ? `${slug}-${randomBytes(2).toString('hex')}` : slug;

  const result = await db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspacesTable)
      .values({
        name: workspaceName!,
        slug: finalSlug,
        plan,
        status: 'active',
        trialEndsAt: plan === 'trial' ? new Date(Date.now() + 14 * 86_400_000) : null,
      })
      .returning();

    const accounts: string[] = [];
    await tx.insert(usersTable).values({
      email: ownerEmail!,
      passwordHash: await bcrypt.hash(ownerPassword, 10),
      name: ownerName,
      role: 'owner',
      workspaceId: ws.id,
    });
    accounts.push(`owner : ${ownerEmail} / ${ownerPassword}`);
    if (!hasFlag('no-demo')) {
      await tx.insert(usersTable).values({
        email: `demo@${finalSlug}.demo`,
        passwordHash: await bcrypt.hash(demoPassword, 10),
        name: 'Akun Demo',
        role: 'demo',
        workspaceId: ws.id,
      });
      accounts.push(`demo  : demo@${finalSlug}.demo / ${demoPassword}  (hanya baca)`);
    }

    if (hasFlag('no-sample')) return { ws, accounts };

    // ── Data contoh generik (semua menempel ke workspace baru ini) ─────────
    const stores = await tx
      .insert(storesTable)
      .values([
        { workspaceId: ws.id, name: 'Brand Contoh', channel: 'Shopee', feePercent: '8.00' },
        { workspaceId: ws.id, name: 'Brand Contoh', channel: 'TikTok Shop', feePercent: '6.00' },
        { workspaceId: ws.id, name: 'Toko Kedua', channel: 'Lazada', feePercent: '7.00' },
      ])
      .returning();
    const [shopee, tiktok, lazada] = stores;

    const suppliers = await tx
      .insert(suppliersTable)
      .values([
        { workspaceId: ws.id, name: 'Suplier Contoh Jaya', whatsapp: '081234567890', category: 'Umum', city: 'Jakarta' },
        { workspaceId: ws.id, name: 'Konveksi Sejahtera', whatsapp: '082345678901', category: 'Fashion', city: 'Bandung' },
      ])
      .returning();

    const products = await tx
      .insert(productsTable)
      .values([
        { storeId: shopee.id, name: 'Produk Contoh A', modal: 42000, sellingPrice: 89000, supplierId: suppliers[0].id, supplierName: suppliers[0].name, supplierPhone: suppliers[0].whatsapp },
        { storeId: shopee.id, name: 'Produk Contoh B', modal: 68000, sellingPrice: 129000, supplierId: suppliers[0].id, supplierName: suppliers[0].name, supplierPhone: suppliers[0].whatsapp },
        { storeId: tiktok.id, name: 'Produk Contoh C', modal: 35000, sellingPrice: 79000, supplierId: suppliers[1].id, supplierName: suppliers[1].name, supplierPhone: suppliers[1].whatsapp },
        { storeId: tiktok.id, name: 'Produk Contoh D', modal: 55000, sellingPrice: 99000, supplierId: suppliers[1].id, supplierName: suppliers[1].name, supplierPhone: suppliers[1].whatsapp },
        { storeId: lazada.id, name: 'Produk Contoh E', modal: 90000, sellingPrice: 165000, supplierId: suppliers[0].id, supplierName: suppliers[0].name, supplierPhone: suppliers[0].whatsapp },
      ])
      .returning();

    // Penjualan 7 hari terakhir biar grafik dashboard langsung hidup.
    const sale = (productIdx: number, daysAgo: number, qty: number, price: number, fee: number, discount = 0) => ({
      productId: products[productIdx].id,
      qty,
      actualPrice: price,
      modalSnapshot: products[productIdx].modal,
      platformFee: fee,
      discount,
      saleDate: day(daysAgo),
    });
    await tx.insert(salesTable).values([
      sale(0, 6, 3, 89000, 7000),
      sale(2, 5, 5, 79000, 5000, 4000),
      sale(1, 4, 2, 129000, 9000),
      sale(4, 3, 1, 165000, 12000),
      sale(3, 2, 4, 99000, 6000),
      sale(0, 1, 6, 89000, 14000, 5000),
      sale(2, 0, 7, 79000, 7000),
      // Contoh status non-omzet: tercatat tapi tidak dihitung laporan.
      { productId: products[1].id, qty: 1, actualPrice: 129000, modalSnapshot: 68000, platformFee: 0, discount: 0, saleDate: day(1), status: 'batal', orderNumber: 'DEMO-0001' },
      { productId: products[3].id, qty: 1, actualPrice: 99000, modalSnapshot: 55000, platformFee: 0, discount: 0, saleDate: day(1), status: 'retur', orderNumber: 'DEMO-0002' },
    ]);

    await tx.insert(metaAdTestsTable).values([
      { workspaceId: ws.id, productName: 'Produk Contoh A', startDate: day(10), status: 'running', totalSpend: 500000, totalLeads: 40, totalClosing: 9, totalRevenue: 801000, notes: 'Contoh kampanye berjalan.', lastUpdated: day(0) },
      { workspaceId: ws.id, productName: 'Produk Contoh C', startDate: day(20), endDate: day(7), status: 'completed', totalSpend: 900000, totalLeads: 45, totalClosing: 4, totalRevenue: 316000, notes: 'Contoh kampanye dihentikan (CPL tinggi).', lastUpdated: day(7) },
    ]);

    const [job] = await tx
      .insert(jobsTable)
      .values({ workspaceId: ws.id, clientName: 'Klien Contoh Abadi', jobType: 'Meta Ads Management', startDate: day(15), deadline: day(-15), status: 'running', contractValue: 3500000, notes: 'Contoh kontrak freelance berjalan.' })
      .returning();
    await tx.insert(jobPaymentsTable).values({ jobId: job.id, paymentDate: day(15), amount: 1500000, type: 'down_payment' });
    await tx.insert(jobCostsTable).values({ jobId: job.id, costDate: day(12), description: 'Contoh biaya iklan testing', amount: 250000 });

    const hosts = await tx
      .insert(hostsTable)
      .values([
        { workspaceId: ws.id, name: 'Host Contoh Satu', phone: '081298765432', commissionType: 'per_hour', rate: 75000 },
        { workspaceId: ws.id, name: 'Host Contoh Dua', phone: '081287654321', commissionType: 'percentage_revenue', rate: 5 },
      ])
      .returning();
    await tx.insert(liveSessionsTable).values({
      hostId: hosts[1].id,
      storeId: tiktok.id,
      sessionDate: day(0),
      startTime: '19:00',
      endTime: '21:00',
      totalOrders: 12,
      totalRevenue: 1380000,
      totalComments: 340,
      commissionAmount: 69000,
      commissionPaid: false,
      notes: 'Contoh sesi live malam.',
    });

    await tx.insert(tasksTable).values([
      { workspaceId: ws.id, title: 'Contoh tugas: siapkan konten mingguan', status: 'todo', priority: 'normal', position: 1000 },
      { workspaceId: ws.id, title: 'Contoh tugas: balas chat pelanggan', status: 'doing', priority: 'normal', position: 1000 },
      { workspaceId: ws.id, title: 'Contoh tugas: cek stok gudang', status: 'done', priority: 'normal', position: 1000, completedAt: new Date() },
    ]);

    const [invoice] = await tx
      .insert(invoicesTable)
      .values({
        workspaceId: ws.id,
        invoiceNumber: 'INV-CONTOH-001',
        title: 'Invoice Contoh',
        clientName: 'Klien Contoh Abadi',
        issueDate: day(10),
        dueDate: day(-20),
        description: 'Contoh invoice jasa pengelolaan iklan bulan ini.',
        issuerName: ownerName,
      })
      .returning();
    await tx.insert(invoiceItemsTable).values([
      { invoiceId: invoice.id, position: 1, description: 'Jasa ads management', qty: '1', unitPrice: 2500000 },
      { invoiceId: invoice.id, position: 2, description: 'Pembuatan konten', qty: '4', unitPrice: 250000 },
    ]);
    await tx.insert(invoicePaymentsTable).values({ invoiceId: invoice.id, paidAt: day(9), amount: 1500000, label: 'DP' });

    const [crmClient] = await tx
      .insert(crmClientsTable)
      .values({ workspaceId: ws.id, name: 'Klien CRM Contoh', category: 'UMKM', phone: '08111222333' })
      .returning();
    const [crmProduct] = await tx
      .insert(crmProductsTable)
      .values({ clientId: crmClient.id, name: 'Paket Promosi Contoh', price: 1500000 })
      .returning();
    await tx.insert(crmLeadsTable).values([
      { clientId: crmClient.id, productId: crmProduct.id, name: 'Lead Hot Contoh', phone: '08111000111', source: 'meta', category: 'hot', notes: 'Contoh lead siap closing.' },
      { clientId: crmClient.id, productId: crmProduct.id, name: 'Lead Warm Contoh', phone: '08111000222', source: 'tiktok', category: 'warm', followUpAt: day(-2) },
      { clientId: crmClient.id, name: 'Lead Follow-up Contoh', phone: '08111000333', source: 'whatsapp', category: 'follow_up' },
    ]);

    return { ws, accounts };
  });

  console.log('\nWorkspace siap dipakai:');
  console.log(`  id    : ${result.ws.id}`);
  console.log(`  nama  : ${result.ws.name}`);
  console.log(`  slug  : ${result.ws.slug}`);
  console.log(`  plan  : ${result.ws.plan}${result.ws.trialEndsAt ? ` (trial s/d ${result.ws.trialEndsAt.toISOString().slice(0, 10)})` : ''}`);
  console.log('\nAkun login:');
  for (const line of result.accounts) console.log(`  ${line}`);
  if (!hasFlag('no-sample')) {
    console.log('\nData contoh: 3 toko, 5 produk, penjualan 7 hari, meta ads, 1 job,');
    console.log('2 host + 1 sesi live, 3 tugas kanban, 1 invoice, 1 klien CRM + 3 leads.');
  }
  console.log('\nSelesai. Kirim kredensial owner ke calon pelanggan.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
