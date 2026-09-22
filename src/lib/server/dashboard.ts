import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  db,
  jobCostsTable,
  jobPaymentsTable,
  jobsTable,
  productsTable,
  salesTable,
  storesTable,
  suppliersTable,
} from '@/lib/db';

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function currentMonth(): string {
  return todayJakarta().slice(0, 7);
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, rawMonth] = month.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, rawMonth, 1));
  return {
    start: `${year.toString().padStart(4, '0')}-${rawMonth.toString().padStart(2, '0')}-01`,
    end: endDate.toISOString().slice(0, 10),
  };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function dateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Job beserta seluruh rincian pembayaran & biaya. Beri `jobId` untuk satu job saja. */
export async function getJobFinancials(jobId?: string) {
  const [jobs, payments, costs] = await Promise.all([
    db
      .select()
      .from(jobsTable)
      .where(jobId ? eq(jobsTable.id, jobId) : undefined)
      .orderBy(desc(jobsTable.startDate)),
    db
      .select()
      .from(jobPaymentsTable)
      .where(jobId ? eq(jobPaymentsTable.jobId, jobId) : undefined)
      .orderBy(desc(jobPaymentsTable.paymentDate)),
    db
      .select()
      .from(jobCostsTable)
      .where(jobId ? eq(jobCostsTable.jobId, jobId) : undefined)
      .orderBy(desc(jobCostsTable.costDate)),
  ]);

  return jobs.map((job) => {
    const jobPayments = payments.filter((payment) => payment.jobId === job.id);
    const jobCosts = costs.filter((cost) => cost.jobId === job.id);
    return {
      job,
      payments: jobPayments,
      costs: jobCosts,
      totalPaid: jobPayments.reduce((sum, item) => sum + item.amount, 0),
      totalCost: jobCosts.reduce((sum, item) => sum + item.amount, 0),
    };
  });
}

export type JobFinancial = Awaited<ReturnType<typeof getJobFinancials>>[number];

export function serializeJob(financial: JobFinancial) {
  const { job, totalPaid, totalCost } = financial;
  return {
    id: job.id,
    clientName: job.clientName,
    jobType: job.jobType,
    startDate: job.startDate,
    deadline: job.deadline,
    status: job.status,
    contractValue: job.contractValue,
    totalPaid,
    totalCost,
    remainingBill: Math.max(job.contractValue - totalPaid, 0),
    profit: totalPaid - totalCost,
    paymentStatus:
      totalPaid <= 0 ? 'not_billed' : totalPaid >= job.contractValue ? 'paid' : 'partial',
    isOverdue: Boolean(
      job.deadline && job.deadline < todayJakarta() && job.status === 'running',
    ),
    notes: job.notes,
  };
}

export { autoPlatformFee } from '@/lib/fees';

export async function getSalesWithLabels(
  options: {
    id?: string;
    start?: string;
    end?: string;
    storeId?: string;
    status?: string;
    limit?: number;
  } = {},
) {
  const conditions = [];
  if (options.id) conditions.push(eq(salesTable.id, options.id));
  if (options.status) conditions.push(eq(salesTable.status, options.status));
  if (options.start) conditions.push(gte(salesTable.saleDate, options.start));
  if (options.end) conditions.push(lt(salesTable.saleDate, options.end));
  if (options.storeId) conditions.push(eq(productsTable.storeId, options.storeId));

  const query = db
    .select({
      sale: salesTable,
      productName: productsTable.name,
      storeName: storesTable.name,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(salesTable.saleDate), desc(salesTable.createdAt));

  const rows = await (options.limit ? query.limit(options.limit) : query);

  return rows.map(({ sale, productName, storeName }) => {
    const grossRevenue = sale.qty * sale.actualPrice - sale.discount;
    const grossProfit = grossRevenue - sale.qty * sale.modalSnapshot - sale.platformFee;
    return {
      id: sale.id,
      productId: sale.productId,
      productName,
      storeName,
      qty: sale.qty,
      actualPrice: sale.actualPrice,
      modalSnapshot: sale.modalSnapshot,
      platformFee: sale.platformFee,
      discount: sale.discount,
      grossRevenue,
      grossProfit,
      date: sale.saleDate,
      status: sale.status,
      orderNumber: sale.orderNumber,
      imageUrl: sale.imageUrl,
    };
  });
}

/**
 * Ringkasan pekerjaan + total bayar/biaya, dihitung di database.
 * Dipakai dashboard supaya tidak perlu memuat semua baris pembayaran dan biaya.
 */
export async function getJobTotals(): Promise<JobFinancial[]> {
  const rows = await db
    .select({
      job: jobsTable,
      // Nama tabel ditulis eksplisit: drizzle membuang prefix tabel pada query
      // satu-tabel, sehingga "job_id = id" di dalam subquery akan salah membaca kolom id.
      totalPaid: sql<string>`coalesce((select sum(jp.amount) from job_payments jp where jp.job_id = jobs.id), 0)`,
      totalCost: sql<string>`coalesce((select sum(jc.amount) from job_costs jc where jc.job_id = jobs.id), 0)`,
    })
    .from(jobsTable)
    .orderBy(desc(jobsTable.startDate));

  return rows.map((row) => ({
    job: row.job,
    payments: [],
    costs: [],
    totalPaid: Number(row.totalPaid) || 0,
    totalCost: Number(row.totalCost) || 0,
  }));
}

/**
 * Buku besar per bulan. Diagregasi di database (GROUP BY bulan), jadi yang
 * dikirim ke server hanya beberapa baris — bukan seluruh tabel penjualan.
 * `sinceMonth` (format YYYY-MM) membatasi ke bulan tersebut dan sesudahnya.
 */
export async function getLedgerRows(sinceMonth?: string) {
  const since = sinceMonth ? `${sinceMonth}-01` : null;

  const saleMonth = sql<string>`to_char(${salesTable.saleDate}, 'YYYY-MM')`;
  const paymentMonth = sql<string>`to_char(${jobPaymentsTable.paymentDate}, 'YYYY-MM')`;
  const costMonth = sql<string>`to_char(${jobCostsTable.costDate}, 'YYYY-MM')`;

  const [salesRows, paymentRows, costRows] = await Promise.all([
    db
      .select({
        month: saleMonth,
        revenue: sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`,
        cost: sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.modalSnapshot} + ${salesTable.platformFee}), 0)`,
      })
      .from(salesTable)
      .where(and(eq(salesTable.status, 'selesai'), since ? gte(salesTable.saleDate, since) : undefined))
      .groupBy(saleMonth),
    db
      .select({ month: paymentMonth, total: sql<string>`coalesce(sum(${jobPaymentsTable.amount}), 0)` })
      .from(jobPaymentsTable)
      .where(since ? gte(jobPaymentsTable.paymentDate, since) : undefined)
      .groupBy(paymentMonth),
    db
      .select({ month: costMonth, total: sql<string>`coalesce(sum(${jobCostsTable.amount}), 0)` })
      .from(jobCostsTable)
      .where(since ? gte(jobCostsTable.costDate, since) : undefined)
      .groupBy(costMonth),
  ]);

  const buckets = new Map<
    string,
    { month: string; jobIncome: number; jobCost: number; posRevenue: number; posCost: number }
  >();

  const getBucket = (month: string) => {
    const existing = buckets.get(month);
    if (existing) return existing;
    const created = { month, jobIncome: 0, jobCost: 0, posRevenue: 0, posCost: 0 };
    buckets.set(month, created);
    return created;
  };

  for (const row of salesRows) {
    const bucket = getBucket(row.month);
    bucket.posRevenue += Number(row.revenue) || 0;
    bucket.posCost += Number(row.cost) || 0;
  }
  for (const row of paymentRows) getBucket(row.month).jobIncome += Number(row.total) || 0;
  for (const row of costRows) getBucket(row.month).jobCost += Number(row.total) || 0;

  return [...buckets.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((bucket) => ({
      month: `${bucket.month}-01`,
      jobIncome: bucket.jobIncome,
      jobCost: bucket.jobCost,
      jobProfit: bucket.jobIncome - bucket.jobCost,
      posRevenue: bucket.posRevenue,
      posCost: bucket.posCost,
      posProfit: bucket.posRevenue - bucket.posCost,
      netProfit: bucket.jobIncome - bucket.jobCost + bucket.posRevenue - bucket.posCost,
    }));
}

export async function getProductsWithStores(activeOnly = true, storeId?: string | null) {
  const rows = await db
    .select({
      product: productsTable,
      storeName: storesTable.name,
      channel: storesTable.channel,
      feePercent: storesTable.feePercent,
      supplierName: suppliersTable.name,
      supplierPhone: suppliersTable.whatsapp,
      totalSold: sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} else 0 end), 0)`,
      transactionCount: sql<string>`count(case when ${salesTable.status} = 'selesai' then ${salesTable.id} end)`,
      revenue: sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} else 0 end), 0)`,
      profit: sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee} else 0 end), 0)`,
      lastSaleDate: sql<string | null>`max(case when ${salesTable.status} = 'selesai' then ${salesTable.saleDate} end)`,
    })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
    .where(
      and(
        activeOnly ? eq(productsTable.isActive, true) : undefined,
        storeId ? eq(productsTable.storeId, storeId) : undefined,
      ),
    )
    .groupBy(
      productsTable.id,
      storesTable.name,
      storesTable.channel,
      storesTable.feePercent,
      suppliersTable.name,
      suppliersTable.whatsapp,
    )
    .orderBy(asc(storesTable.name), asc(productsTable.name));

  return rows.map(
    ({
      product,
      storeName,
      channel,
      feePercent,
      supplierName,
      supplierPhone,
      totalSold,
      transactionCount,
      revenue,
      profit,
      lastSaleDate,
    }) => {
    const revenueValue = Number(revenue) || 0;
    const profitValue = Number(profit) || 0;
    return {
    id: product.id,
    storeId: product.storeId,
    supplierId: product.supplierId,
    storeName,
    channel,
    feePercent: Number(feePercent) || 0,
    name: product.name,
    modal: product.modal,
    targetMargin: product.targetMargin == null ? null : Number(product.targetMargin),
    sellingPrice: product.sellingPrice,
    supplierName: supplierName ?? product.supplierName,
    supplierPhone: supplierPhone ?? product.supplierPhone,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    totalSold: Number(totalSold) || 0,
    transactionCount: Number(transactionCount) || 0,
    revenue: revenueValue,
    profit: profitValue,
    margin: revenueValue > 0 ? Math.round((profitValue / revenueValue) * 1000) / 10 : 0,
    lastSaleDate: lastSaleDate ? String(lastSaleDate) : null,
    };
    },
  );
}

export function monthRangeFilter(month?: string) {
  if (!month) return undefined;
  const bounds = monthBounds(month);
  return and(gte(salesTable.saleDate, bounds.start), lt(salesTable.saleDate, bounds.end));
}

/**
 * Tren POS khusus dashboard. Jangan memakai getLedgerRows di sini: ledger
 * lengkap juga membaca pembayaran dan biaya freelance, padahal dashboard
 * hanya membutuhkan penjualan toko. Agregasi langsung di database membuat
 * dashboard tidak memuat tabel yang tidak dipakai.
 */
export async function getPosTrendRows(sinceMonth: string) {
  const since = `${sinceMonth}-01`;
  const month = sql<string>`to_char(${salesTable.saleDate}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month,
      revenue: sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`,
      profit: sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee}), 0)`,
    })
    .from(salesTable)
    .where(and(eq(salesTable.status, 'selesai'), gte(salesTable.saleDate, since)))
    .groupBy(month);

  return rows.map((row) => ({
    month: `${row.month}-01`,
    posRevenue: Number(row.revenue) || 0,
    posProfit: Number(row.profit) || 0,
  }));
}
