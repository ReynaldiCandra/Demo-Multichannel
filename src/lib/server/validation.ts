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

export const StoreInput = z.object({
  name: z.string().min(1, 'Nama brand wajib diisi'),
  channel: z.string().min(1, 'Kanal wajib diisi'),
  isActive: z.boolean().optional().default(true),
  /** Potongan platform (%) dari omzet. 0 = biaya diisi manual di tiap transaksi. */
  feePercent: z.coerce.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%').optional().default(0),
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
  commissionAmount: z.coerce.number().int().min(0).default(0),
  commissionPaid: z.boolean().default(false),
  notes: nullableText,
});

export const MonthQuery = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM')
  .optional();

export const ModuleUpdateInput = z.object({
  isEnabled: z.boolean(),
});

export type StoreInputType = z.infer<typeof StoreInput>;
export type ProductInputType = z.infer<typeof ProductInput>;
export type SaleInputType = z.infer<typeof SaleInput>;
export type MetaAdTestInputType = z.infer<typeof MetaAdTestInput>;
export type JobInputType = z.infer<typeof JobInput>;
export type HostInputType = z.infer<typeof HostInput>;
export type LiveSessionInputType = z.infer<typeof LiveSessionInput>;
