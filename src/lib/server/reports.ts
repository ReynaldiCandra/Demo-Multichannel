import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import { monthBounds } from './dashboard';

export type StorePerformanceRow = {
  storeId: string;
  storeName: string;
  channel: string;
  label: string;
  orders: number;
  transactions: number;
  revenue: number;
  cost: number;
  hpp: number;
  platformFee: number;
  profit: number;
  revenueShare: number;
};

export type BrandPerformanceRow = {
  brand: string;
  channels: number;
  orders: number;
  revenue: number;
  profit: number;
  revenueShare: number;
};

export type StorePerformanceReport = {
  month: string | null;
  totals: {
    orders: number;
    transactions: number;
    revenue: number;
    cost: number;
    hpp: number;
    platformFee: number;
    profit: number;
  };
  stores: StorePerformanceRow[];
  brands: BrandPerformanceRow[];
  topProducts: Array<{
    productId: string;
    productName: string;
    storeName: string;
    channel: string;
    pcs: number;
    revenue: number;
    profit: number;
    margin: number;
  }>;
};

/**
 * Omzet dan profit per toko untuk satu bulan (atau sepanjang waktu kalau month
 * kosong), diagregasi di database.
 *
 * Dihitung dari SELURUH penjualan pada periode tersebut — bukan dari 5
 * transaksi terakhir seperti perhitungan lama di dashboard, yang membuat
 * persentase kontribusi kanal menyesatkan begitu transaksi lebih dari lima.
 *
 * Toko tanpa penjualan tetap ikut tampil dengan nilai nol, supaya kanal yang
 * mandek kelihatan dan bukan hilang dari daftar.
 */
export async function getStorePerformance(month?: string): Promise<StorePerformanceReport> {
  const bounds = month ? monthBounds(month) : null;

  const revenueExpr = sql<number>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`;
  const costExpr = sql<number>`coalesce(sum(${salesTable.qty} * ${salesTable.modalSnapshot} + ${salesTable.platformFee}), 0)`;
  const hppExpr = sql<number>`coalesce(sum(${salesTable.qty} * ${salesTable.modalSnapshot}), 0)`;

  const storeQuery = db
    .select({
      storeId: storesTable.id,
      storeName: storesTable.name,
      channel: storesTable.channel,
      isActive: storesTable.isActive,
      orders: sql<number>`coalesce(sum(${salesTable.qty}), 0)`,
      transactions: sql<number>`count(${salesTable.id})`,
      revenue: revenueExpr,
      cost: costExpr,
      hpp: hppExpr,
    })
    .from(storesTable)
    .leftJoin(productsTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(
      salesTable,
      bounds
        ? and(
            eq(salesTable.productId, productsTable.id),
            eq(salesTable.status, 'selesai'),
            gte(salesTable.saleDate, bounds.start),
            lt(salesTable.saleDate, bounds.end),
          )
        : and(eq(salesTable.productId, productsTable.id), eq(salesTable.status, 'selesai')),
    )
    .groupBy(storesTable.id, storesTable.name, storesTable.channel, storesTable.isActive)
    .orderBy(asc(storesTable.name), asc(storesTable.channel));

  const topProductRows = db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      storeName: storesTable.name,
      channel: storesTable.channel,
      pcs: sql<number>`coalesce(sum(${salesTable.qty}), 0)`,
      revenue: sql<number>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`,
      profit: sql<number>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee}), 0)`,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(
      bounds
        ? and(
            eq(salesTable.status, 'selesai'),
            gte(salesTable.saleDate, bounds.start),
            lt(salesTable.saleDate, bounds.end),
          )
        : eq(salesTable.status, 'selesai'),
    )
    .groupBy(productsTable.id, productsTable.name, storesTable.name, storesTable.channel)
    .orderBy(desc(sql`coalesce(sum(${salesTable.qty}), 0)`), desc(sql`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee}), 0)`))
    .limit(5);

  // Kedua agregasi membaca periode yang sama dan tidak memicu fetch tambahan
  // dari dashboard. Promise.all menjaga waktu tunggu satu request tetap pendek.
  const [rows, topProductRowsResult] = await Promise.all([storeQuery, topProductRows]);

  const normalized = rows.map((row) => {
    const revenue = Number(row.revenue) || 0;
    const cost = Number(row.cost) || 0;
    const hpp = Number(row.hpp) || 0;
    return {
      storeId: row.storeId,
      storeName: row.storeName,
      channel: row.channel,
      label: `${row.storeName} (${row.channel})`,
      orders: Number(row.orders) || 0,
      transactions: Number(row.transactions) || 0,
      revenue,
      cost,
      hpp,
      platformFee: cost - hpp,
      profit: revenue - cost,
    };
  });

  const totalRevenue = normalized.reduce((sum, row) => sum + row.revenue, 0);
  const share = (revenue: number) =>
    totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0;

  const stores: StorePerformanceRow[] = normalized
    .map((row) => ({ ...row, revenueShare: share(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  // Gabungan lintas kanal: "Sora & Soul" di Shopee + Lazada + TikTok jadi satu baris.
  const brandMap = new Map<string, BrandPerformanceRow>();
  for (const row of normalized) {
    const current = brandMap.get(row.storeName) ?? {
      brand: row.storeName,
      channels: 0,
      orders: 0,
      revenue: 0,
      profit: 0,
      revenueShare: 0,
    };
    current.channels += 1;
    current.orders += row.orders;
    current.revenue += row.revenue;
    current.profit += row.profit;
    brandMap.set(row.storeName, current);
  }

  const brands = [...brandMap.values()]
    .map((brand) => ({ ...brand, revenueShare: share(brand.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts = topProductRowsResult.map((row) => {
    const revenue = Number(row.revenue) || 0;
    const profit = Number(row.profit) || 0;
    return {
      productId: row.productId,
      productName: row.productName,
      storeName: row.storeName,
      channel: row.channel,
      pcs: Number(row.pcs) || 0,
      revenue,
      profit,
      margin: percent(profit, revenue),
    };
  });

  return {
    month: month ?? null,
    totals: {
      orders: normalized.reduce((sum, row) => sum + row.orders, 0),
      transactions: normalized.reduce((sum, row) => sum + row.transactions, 0),
      revenue: totalRevenue,
      cost: normalized.reduce((sum, row) => sum + row.cost, 0),
      hpp: normalized.reduce((sum, row) => sum + row.hpp, 0),
      platformFee: normalized.reduce((sum, row) => sum + row.platformFee, 0),
      profit: normalized.reduce((sum, row) => sum + row.profit, 0),
    },
    stores,
    brands,
    topProducts,
  };
}


/* ------------------------------------------------------------------ */
/* Analisa toko: ringkasan + peringkat produk + tren harian            */
/* ------------------------------------------------------------------ */

export type SalesReportSort = 'pcs' | 'revenue' | 'profit' | 'margin';

export type SalesReportFilters = {
  /** Format YYYY-MM. Kosong = akumulasi seluruh waktu. */
  month?: string | null;
  /** Nama brand, mis. "Rise & Wars" (gabungan semua kanal). */
  brand?: string | null;
  /** Satu kanal spesifik (satu baris di tabel stores). */
  storeId?: string | null;
  sort?: SalesReportSort;
  limit?: number;
};

type Metrics = {
  pcs: number;
  transactions: number;
  revenue: number;
  hpp: number;
  platformFee: number;
  discount: number;
  profit: number;
  margin: number;
};

export type SalesReportProduct = Metrics & {
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  channel: string;
  /** Porsi terhadap total pcs / omzet pada filter yang sama, dalam persen. */
  pcsShare: number;
  revenueShare: number;
};

export type SalesReport = {
  month: string | null;
  totals: Metrics & { averageOrder: number; activeProducts: number };
  products: SalesReportProduct[];
  channels: Array<
    Metrics & { storeId: string; storeName: string; channel: string; revenueShare: number }
  >;
  /** Batal dan retur: dicatat tapi TIDAK ikut omzet/profit. */
  excluded: {
    batal: { transactions: number; pcs: number; revenue: number };
    retur: { transactions: number; pcs: number; revenue: number };
  };
  daily: Array<{ date: string; pcs: number; revenue: number; profit: number }>;
  filters: {
    brands: Array<{
      brand: string;
      channels: Array<{ storeId: string; channel: string; isActive: boolean }>;
    }>;
  };
};

// Daftar toko dipakai untuk filter pill di halaman /toko dan hampir tidak
// pernah berubah dalam hitungan detik. Sebelumnya query ini dijalankan ulang
// di SETIAP klik filter, ikut merebut slot dari pool koneksi yang kecil.
// Cache singkat di memory proses menghilangkan query itu dari jalur cepat
// tanpa membuat data toko baru butuh waktu lama untuk muncul.
type StoreListRow = { id: string; name: string; channel: string; isActive: boolean };
let storeListCache: { rows: StoreListRow[]; expiresAt: number } | null = null;
const STORE_LIST_CACHE_MS = 15_000;

async function getStoreList(): Promise<StoreListRow[]> {
  const now = Date.now();
  if (storeListCache && storeListCache.expiresAt > now) return storeListCache.rows;
  const rows = await db
    .select({
      id: storesTable.id,
      name: storesTable.name,
      channel: storesTable.channel,
      isActive: storesTable.isActive,
    })
    .from(storesTable)
    .orderBy(asc(storesTable.name), asc(storesTable.channel));
  storeListCache = { rows, expiresAt: now + STORE_LIST_CACHE_MS };
  return rows;
}

const toNumber = (value: unknown) => Number(value) || 0;
const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

function metrics(row: {
  pcs: unknown;
  transactions: unknown;
  revenue: unknown;
  hpp: unknown;
  fee: unknown;
  discount: unknown;
}): Metrics {
  const revenue = toNumber(row.revenue);
  const hpp = toNumber(row.hpp);
  const platformFee = toNumber(row.fee);
  const profit = revenue - hpp - platformFee;
  return {
    pcs: toNumber(row.pcs),
    transactions: toNumber(row.transactions),
    revenue,
    hpp,
    platformFee,
    discount: toNumber(row.discount),
    profit,
    margin: percent(profit, revenue),
  };
}

/**
 * Laporan penjualan untuk satu filter (semua toko / satu brand / satu kanal),
 * untuk satu bulan atau akumulasi. Semua dihitung di database lewat GROUP BY,
 * jadi cepat walau transaksi sudah ribuan.
 *
 *   Omzet      = qty × harga aktual − diskon
 *   HPP/Modal  = qty × modal (snapshot saat transaksi, tidak berubah walau modal produk diedit)
 *   Net profit = omzet − HPP − biaya platform
 */
export async function getSalesReport(filters: SalesReportFilters = {}): Promise<SalesReport> {
  const month = filters.month || null;
  const bounds = month ? monthBounds(month) : null;
  const sort: SalesReportSort = filters.sort ?? 'pcs';
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);

  const baseConditions = [
    bounds ? gte(salesTable.saleDate, bounds.start) : undefined,
    bounds ? lt(salesTable.saleDate, bounds.end) : undefined,
    filters.storeId ? eq(storesTable.id, filters.storeId) : undefined,
    filters.brand ? eq(storesTable.name, filters.brand) : undefined,
  ].filter((condition) => condition !== undefined);
  // Hanya pesanan selesai yang dihitung sebagai omzet dan profit.
  const where = and(...baseConditions, eq(salesTable.status, 'selesai'));
  // baseWhere (tanpa filter status) dipakai untuk satu query gabungan yang
  // menghitung total "selesai" DAN total batal/retur sekaligus lewat GROUP BY
  // status — dulu ini dua query terpisah yang masing-masing join+scan tabel
  // yang sama.
  const baseWhere = baseConditions.length ? and(...baseConditions) : undefined;

  const pcs = sql<string>`coalesce(sum(${salesTable.qty}), 0)`;
  const transactions = sql<string>`count(${salesTable.id})`;
  const revenue = sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}), 0)`;
  const hpp = sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.modalSnapshot}), 0)`;
  const fee = sql<string>`coalesce(sum(${salesTable.platformFee}), 0)`;
  const discount = sql<string>`coalesce(sum(${salesTable.discount}), 0)`;
  const profit = sql<string>`coalesce(sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee}), 0)`;

  const orderBy =
    sort === 'revenue'
      ? [desc(revenue), desc(pcs)]
      : sort === 'profit'
        ? [desc(profit), desc(pcs)]
        : sort === 'margin'
          ? [
              desc(
                sql`case when sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}) > 0 then (sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} - ${salesTable.qty} * ${salesTable.modalSnapshot} - ${salesTable.platformFee}) * 100.0) / sum(${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount}) else 0 end`,
              ),
              desc(pcs),
            ]
        : [desc(pcs), desc(revenue)];

  const day = sql<string>`to_char(${salesTable.saleDate}, 'YYYY-MM-DD')`;

  const [statusRows, productRows, channelRows, dailyRows, storeRows] = await Promise.all([
    // Gabungan totalRows (status = selesai) + excludedRows (batal/retur) jadi
    // satu query lewat GROUP BY status, bukan dua query terpisah.
    db
      .select({
        status: salesTable.status,
        pcs,
        transactions,
        revenue,
        hpp,
        fee,
        discount,
        products: sql<string>`count(distinct ${salesTable.productId})`,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
      .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(baseWhere)
      .groupBy(salesTable.status),
    db
      .select({
        productId: productsTable.id,
        productName: productsTable.name,
        storeId: storesTable.id,
        storeName: storesTable.name,
        channel: storesTable.channel,
        pcs,
        transactions,
        revenue,
        hpp,
        fee,
        discount,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
      .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(where)
      .groupBy(productsTable.id, productsTable.name, storesTable.id, storesTable.name, storesTable.channel)
      .orderBy(...orderBy, asc(productsTable.name))
      .limit(limit),
    db
      .select({
        storeId: storesTable.id,
        storeName: storesTable.name,
        channel: storesTable.channel,
        pcs,
        transactions,
        revenue,
        hpp,
        fee,
        discount,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
      .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(where)
      .groupBy(storesTable.id, storesTable.name, storesTable.channel)
      .orderBy(desc(revenue)),
    db
      .select({ date: day, pcs, revenue, profit })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
      .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(where)
      .groupBy(day)
      .orderBy(asc(day)),
    // Daftar toko dari cache — tidak membuka koneksi baru selama masih segar.
    getStoreList(),
  ]);

  const excludedFor = (status: string) => {
    const row = statusRows.find((item) => item.status === status);
    return {
      transactions: toNumber(row?.transactions),
      pcs: toNumber(row?.pcs),
      revenue: toNumber(row?.revenue),
    };
  };

  const totalRow =
    statusRows.find((item) => item.status === 'selesai') ??
    { pcs: 0, transactions: 0, revenue: 0, hpp: 0, fee: 0, discount: 0, products: 0 };
  const totals = metrics(totalRow);

  const brandMap = new Map<string, SalesReport['filters']['brands'][number]>();
  for (const store of storeRows) {
    const entry = brandMap.get(store.name) ?? { brand: store.name, channels: [] };
    entry.channels.push({ storeId: store.id, channel: store.channel, isActive: store.isActive });
    brandMap.set(store.name, entry);
  }

  return {
    month,
    totals: {
      ...totals,
      averageOrder: totals.transactions > 0 ? Math.round(totals.revenue / totals.transactions) : 0,
      activeProducts: toNumber(totalRow.products),
    },
    products: productRows.map((row) => {
      const m = metrics(row);
      return {
        productId: row.productId,
        productName: row.productName,
        storeId: row.storeId,
        storeName: row.storeName,
        channel: row.channel,
        ...m,
        pcsShare: percent(m.pcs, totals.pcs),
        revenueShare: percent(m.revenue, totals.revenue),
      };
    }),
    channels: channelRows.map((row) => {
      const m = metrics(row);
      return {
        storeId: row.storeId,
        storeName: row.storeName,
        channel: row.channel,
        ...m,
        revenueShare: percent(m.revenue, totals.revenue),
      };
    }),
    excluded: { batal: excludedFor('batal'), retur: excludedFor('retur') },
    daily: dailyRows.map((row) => ({
      date: row.date,
      pcs: toNumber(row.pcs),
      revenue: toNumber(row.revenue),
      profit: toNumber(row.profit),
    })),
    filters: { brands: [...brandMap.values()] },
  };
}
