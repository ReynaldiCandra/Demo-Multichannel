import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Satu baris = satu brand di satu kanal. "Sora & Soul" di Shopee, Lazada dan
 * TikTok Shop adalah tiga baris dengan `name` sama dan `channel` berbeda, jadi
 * omzet bisa dibaca per kanal maupun digabung per brand.
 */
export const storesTable = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    channel: text('channel').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    // Potongan platform dalam persen dari omzet transaksi (0 = isi manual per transaksi).
    feePercent: numeric('fee_percent', { precision: 5, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('stores_name_channel_unique').on(table.name, table.channel),
    index('stores_channel_active_idx').on(table.channel, table.isActive),
  ],
);

/**
 * Daftar suplier terpisah dari `supplierName`/`supplierPhone` bebas di
 * `products` — supaya kontak, kategori, dan daerah suplier bisa dikelola
 * (CRUD) sendiri, bukan diketik ulang tiap kali input produk.
 */
export const suppliersTable = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  whatsapp: text('whatsapp'),
  category: text('category'),
  city: text('city'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productsTable = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id')
    .notNull()
    .references(() => storesTable.id),
  supplierId: uuid('supplier_id')
    .references(() => suppliersTable.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  modal: integer('modal').notNull().default(0),
  targetMargin: numeric('target_margin', { precision: 5, scale: 2 }),
  sellingPrice: integer('selling_price').notNull().default(0),
  supplierName: text('supplier_name'),
  supplierPhone: text('supplier_phone'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('products_store_id_idx').on(table.storeId),
  index('products_supplier_id_idx').on(table.supplierId),
  index('products_store_active_idx').on(table.storeId, table.isActive),
]);

export const salesTable = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => productsTable.id),
  qty: integer('qty').notNull(),
  actualPrice: integer('actual_price').notNull(),
  modalSnapshot: integer('modal_snapshot').notNull(),
  platformFee: integer('platform_fee').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  saleDate: date('sale_date', { mode: 'string' }).notNull(),
  // selesai | batal | retur — hanya "selesai" yang dihitung di omzet dan profit.
  status: text('status').notNull().default('selesai'),
  orderNumber: text('order_number'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sales_order_number_idx').on(table.orderNumber),
  index('sales_product_id_idx').on(table.productId),
  index('sales_sale_date_idx').on(table.saleDate),
  index('sales_status_sale_date_idx').on(table.status, table.saleDate),
  index('sales_product_status_date_idx').on(table.productId, table.status, table.saleDate),
  // Laporan per toko/produk per periode: filter tanggal lalu kelompokkan per produk.
  index('sales_sale_date_product_idx').on(table.saleDate, table.productId),
]);

export const metaAdTestsTable = pgTable('meta_ad_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  productName: text('product_name').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  status: text('status').notNull().default('running'),
  totalSpend: integer('total_spend').notNull().default(0),
  totalLeads: integer('total_leads').notNull().default(0),
  totalClosing: integer('total_closing').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  notes: text('notes'),
  lastUpdated: date('last_updated', { mode: 'string' }).notNull(),
});

export const jobsTable = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientName: text('client_name').notNull(),
  jobType: text('job_type').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  deadline: date('deadline', { mode: 'string' }),
  status: text('status').notNull().default('running'),
  contractValue: integer('contract_value').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobCostsTable = pgTable('job_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobsTable.id, { onDelete: 'cascade' }),
  costDate: date('cost_date', { mode: 'string' }).notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
}, (table) => [index('job_costs_job_id_idx').on(table.jobId)]);

export const jobPaymentsTable = pgTable('job_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobsTable.id, { onDelete: 'cascade' }),
  paymentDate: date('payment_date', { mode: 'string' }).notNull(),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
}, (table) => [index('job_payments_job_id_idx').on(table.jobId)]);

export const hostsTable = pgTable('hosts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone'),
  commissionType: text('commission_type').notNull().default('per_hour'),
  rate: integer('rate').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const liveSessionsTable = pgTable('live_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: uuid('host_id')
    .notNull()
    .references(() => hostsTable.id),
  storeId: uuid('store_id')
    .notNull()
    .references(() => storesTable.id),
  sessionDate: date('session_date', { mode: 'string' }).notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  totalOrders: integer('total_orders').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  commissionAmount: integer('commission_amount').notNull().default(0),
  commissionPaid: boolean('commission_paid').notNull().default(false),
  notes: text('notes'),
}, (table) => [index('live_sessions_session_date_idx').on(table.sessionDate)]);

export type Store = typeof storesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Sale = typeof salesTable.$inferSelect;
export type MetaAdTest = typeof metaAdTestsTable.$inferSelect;
export type Job = typeof jobsTable.$inferSelect;
export type JobCost = typeof jobCostsTable.$inferSelect;
export type JobPayment = typeof jobPaymentsTable.$inferSelect;
export type Host = typeof hostsTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type LiveSession = typeof liveSessionsTable.$inferSelect;

/**
 * Akun login. `role` menentukan hak akses:
 *  - owner : akses penuh
 *  - demo  : hanya baca, semua aksi tulis ditolak di server
 */
export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('owner'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Modul yang bisa dinyalakan/dimatikan, mirip Apps di Odoo. Dipakai untuk
 * menyiapkan demo terbatas bagi owner yang mau mencoba.
 */
export const modulesTable = pgTable('modules', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  description: text('description').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  isCore: boolean('is_core').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type User = typeof usersTable.$inferSelect;
export type AppModule = typeof modulesTable.$inferSelect;
