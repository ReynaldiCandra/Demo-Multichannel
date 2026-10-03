import { z } from 'zod';

const dateString = z
  .string()
  .min(1)
  .transform((value) => value.slice(0, 10));

const optionalDateString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value ? value.slice(0, 10) : null));

const nullableText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

/**
 * Skema aksi massal (bulk): body berisi daftar ID resource yang dipilih.
 * Dipakai bersama oleh semua endpoint bulk (produk, suplier, invoice, CRM).
 */
export const BulkIdsInput = z.object({
  ids: z
    .array(z.string().uuid('ID tidak valid'))
    .min(1, 'Pilih minimal satu data.')
    .max(200, 'Maksimal 200 data per aksi.'),
});

/** Bulk update status aktif/nonaktif (produk & suplier). */
export const BulkActiveInput = BulkIdsInput.extend({
  isActive: z.boolean(),
});

export const StoreInput = z.object({
  name: z.string().min(1, 'Nama brand wajib diisi'),
  channel: z.string().min(1, 'Kanal wajib diisi'),
  isActive: z.boolean().optional().default(true),
  /** Potongan platform (%) dari omzet. 0 = biaya diisi manual di tiap transaksi. */
  feePercent: z.coerce.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%').optional().default(0),
  /** Logo/foto brand toko (URL hasil upload Vercel Blob). */
  imageUrl: z.string().url('URL logo tidak valid').nullable().optional(),
});

export const ProductInput = z.object({
  storeId: z.string().uuid('Toko tidak valid'),
  supplierId: z.string().uuid('Supplier tidak valid').nullable().optional(),
  name: z.string().min(1, 'Nama produk wajib diisi'),
  modal: z.coerce.number().int().min(0).default(0),
  sellingPrice: z.coerce.number().int().min(0).default(0),
  targetMargin: z.coerce.number().min(0).nullable().optional(),
  supplierName: nullableText,
  supplierPhone: nullableText,
  imageUrl: z.string().url('URL foto tidak valid').nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const SALE_STATUSES = ['selesai', 'batal', 'retur'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SaleInput = z.object({
  productId: z.string().uuid('Produk tidak valid'),
  qty: z.coerce.number().int().min(1, 'Jumlah minimal 1'),
  actualPrice: z.coerce.number().int().min(0),
  /** Kosong / null = dihitung otomatis dari persentase biaya platform toko. */
  platformFee: z.coerce.number().int().min(0).nullable().optional(),
  discount: z.coerce.number().int().min(0).default(0),
  date: dateString,
  status: z.enum(SALE_STATUSES).default('selesai'),
  orderNumber: z
    .string()
    .trim()
    .max(64, 'Nomor pesanan maksimal 64 karakter')
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  imageUrl: z.string().url('URL foto tidak valid').nullable().optional(),
});

export const MetaAdTestInput = z.object({
  productName: z.string().min(1, 'Nama produk wajib diisi'),
  startDate: dateString,
  endDate: optionalDateString,
  status: z.enum(['running', 'completed', 'stopped']).default('running'),
  totalSpend: z.coerce.number().int().min(0).default(0),
  totalLeads: z.coerce.number().int().min(0).default(0),
  totalClosing: z.coerce.number().int().min(0).default(0),
  totalRevenue: z.coerce.number().int().min(0).default(0),
  notes: nullableText,
});

export const JobInput = z.object({
  clientName: z.string().min(1, 'Nama klien wajib diisi'),
  jobType: z.string().min(1, 'Jenis pekerjaan wajib diisi'),
  startDate: dateString,
  deadline: optionalDateString,
  status: z.enum(['running', 'completed', 'cancelled']).default('running'),
  contractValue: z.coerce.number().int().min(0).default(0),
  notes: nullableText,
});

export const JobCostInput = z.object({
  date: dateString,
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  amount: z.coerce.number().int().min(0),
});

export const JobPaymentInput = z.object({
  date: dateString,
  amount: z.coerce.number().int().min(0),
  type: z.enum(['down_payment', 'settlement', 'other']).default('settlement'),
});

export const SupplierInput = z.object({
  name: z.string().min(1, 'Nama suplier wajib diisi'),
  whatsapp: nullableText,
  category: nullableText,
  city: nullableText,
  imageUrl: z.string().url('URL foto tidak valid').nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const HostInput = z.object({
  name: z.string().min(1, 'Nama host wajib diisi'),
  phone: nullableText,
  commissionType: z.enum(['per_hour', 'per_order', 'percentage_revenue']).default('per_hour'),
  rate: z.coerce.number().int().min(0).default(0),
  /** Foto host (URL hasil upload Vercel Blob). */
  imageUrl: z.string().url('URL foto tidak valid').nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const LiveSessionInput = z.object({
  hostId: z.string().uuid('Host tidak valid'),
  storeId: z.string().uuid('Toko tidak valid'),
  date: dateString,
  startTime: nullableText,
  endTime: nullableText,
  totalOrders: z.coerce.number().int().min(0).default(0),
  totalRevenue: z.coerce.number().int().min(0).default(0),
  /** Jumlah komentar live (engagement); opsional, default 0. */
  totalComments: z.coerce.number().int().min(0).default(0),
  commissionAmount: z.coerce.number().int().min(0).default(0),
  commissionPaid: z.boolean().default(false),
  notes: nullableText,
});

/** Periode laporan: mingguan (YYYY-Www), bulanan (YYYY-MM), tahunan (YYYY). */
export const PERIOD_PATTERN = /^(\d{4}-W\d{2}|\d{4}-\d{2}|\d{4})$/;

export const MonthQuery = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
  .optional();

export const SETTLEMENT_STATUSES = ['pending', 'released'] as const;

export const SettlementInput = z.object({
  status: z.enum(SETTLEMENT_STATUSES),
  /** Wajib saat status released: nominal riil yang benar-benar cair. */
  releasedAmount: z.coerce.number().int().min(0).nullable().optional(),
  releasedDate: optionalDateString,
});

const invoiceItemInput = z.object({
  id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, 'Deskripsi item wajib diisi').max(300),
  // Qty boleh desimal (2.5 m²); server menyimpan numeric(12,2).
  qty: z.coerce.number().min(0.01).max(9999999999.99).default(1),
  unitPrice: z.coerce.number().int().min(0).default(0),
});

export const InvoiceInput = z.object({
  invoiceNumber: z.string().trim().min(1, 'Nomor invoice wajib diisi').max(64),
  title: z.string().trim().min(1).max(120).default('Invoice'),
  clientName: z.string().trim().min(1, 'Nama klien wajib diisi').max(120),
  clientAddress: nullableText,
  issuerName: nullableText,
  issuerAddress: nullableText,
  issueDate: dateString,
  dueDate: optionalDateString,
  description: nullableText,
  scopeText: nullableText,
  logoUrl: z.string().url('URL logo tidak valid').nullable().optional(),
  notes: nullableText,
  items: z.array(invoiceItemInput).min(1, 'Minimal satu item'),
  // Tanggal + nominal + label bebas: DP, cicilan, pelunasan, dst.
  payments: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        paidAt: dateString,
        amount: z.coerce.number().int().min(0),
        label: nullableText,
      }),
    )
    .default([]),
});

export const ModuleUpdateInput = z.object({
  isEnabled: z.boolean(),
});

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;

export const TaskCreateInput = z.object({
  title: z.string().trim().min(1, 'Judul tugas wajib diisi').max(200),
  notes: nullableText,
  priority: z.enum(TASK_PRIORITIES).default('normal'),
  dueDate: optionalDateString,
});

export const TaskUpdateInput = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    notes: nullableText,
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: optionalDateString,
    status: z.enum(TASK_STATUSES).optional(),
    // Posisi boleh negatif — kartu baru selalu ditaruh di min(posisi) - 100.
    position: z.coerce.number().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan yang dikirim',
  });

export type StoreInputType = z.infer<typeof StoreInput>;
export type ProductInputType = z.infer<typeof ProductInput>;
export type SaleInputType = z.infer<typeof SaleInput>;
export type MetaAdTestInputType = z.infer<typeof MetaAdTestInput>;
export type JobInputType = z.infer<typeof JobInput>;
export type HostInputType = z.infer<typeof HostInput>;
export type LiveSessionInputType = z.infer<typeof LiveSessionInput>;

/* ------------------------------------------------------------------ */
/* CRM Leads                                                           */
/* ------------------------------------------------------------------ */

export const CRM_LEAD_CATEGORIES = ['hot', 'warm', 'closing', 'follow_up'] as const;

/** Bulk pindah kategori pipeline lead CRM. */
export const BulkCategoryInput = BulkIdsInput.extend({
  category: z.enum(CRM_LEAD_CATEGORIES),
});

export const CrmClientInput = z.object({
  name: z.string().trim().min(1, 'Nama klien wajib diisi').max(120),
  category: nullableText,
  contactName: nullableText,
  phone: nullableText,
  notes: nullableText,
});

export const CrmClientUpdateInput = CrmClientInput.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan yang dikirim' },
);

export const CrmProductInput = z.object({
  clientId: z.string().uuid('Klien tidak valid'),
  name: z.string().trim().min(1, 'Nama produk wajib diisi').max(160),
  price: z.coerce.number().int().min(0).default(0),
  notes: nullableText,
});

export const CrmProductUpdateInput = CrmProductInput.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan yang dikirim' },
);

export const CrmLeadCreateInput = z.object({
  clientId: z.string().uuid('Klien tidak valid'),
  productId: z.string().uuid('Produk tidak valid').nullable().optional(),
  name: z.string().trim().min(1, 'Nama lead wajib diisi').max(120),
  phone: nullableText,
  region: nullableText,
  source: z.string().trim().min(1).max(40).default('meta'),
  category: z.enum(CRM_LEAD_CATEGORIES).default('follow_up'),
  notes: nullableText,
  followUpAt: optionalDateString,
});

export const CrmLeadUpdateInput = z
  .object({
    productId: z.string().uuid('Produk tidak valid').nullable().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    phone: nullableText,
    region: nullableText,
    source: z.string().trim().min(1).max(40).optional(),
    category: z.enum(CRM_LEAD_CATEGORIES).optional(),
    notes: nullableText,
    followUpAt: optionalDateString,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan yang dikirim',
  });
