export type StoreRow = {
  id: string;
  name: string;
  channel: string;
  isActive: boolean;
  /** Potongan platform (%) — dipakai menghitung biaya platform otomatis. */
  feePercent: number;
  productCount: number;
  transactionCount: number;
};

export type ProductRow = {
  id: string;
  storeId: string;
  supplierId: string | null;
  storeName: string;
  channel: string;
  /** Persentase biaya platform toko produk ini. */
  feePercent: number;
  name: string;
  modal: number;
  targetMargin: number | null;
  sellingPrice: number;
  supplierName: string | null;
  supplierPhone: string | null;
  imageUrl: string | null;
  isActive: boolean;
  totalSold: number;
  transactionCount: number;
  revenue: number;
  profit: number;
  margin: number;
  lastSaleDate: string | null;
};

export type SaleRow = {
  id: string;
  productId: string;
  productName: string;
  storeName: string;
  qty: number;
  actualPrice: number;
  modalSnapshot: number;
  platformFee: number;
  discount: number;
  grossRevenue: number;
  grossProfit: number;
  date: string;
  status: SaleStatus;
  orderNumber: string | null;
  imageUrl: string | null;
};

export type SaleStatus = 'selesai' | 'batal' | 'retur';

export type MetaAdTestRow = {
  id: string;
  productName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  totalSpend: number;
  totalLeads: number;
  totalClosing: number;
  totalRevenue: number;
  costPerLead: number | null;
  costPerClosing: number | null;
  notes: string | null;
  lastUpdated: string;
};

export type JobSummary = {
  id: string;
  clientName: string;
  jobType: string;
  startDate: string;
  deadline: string | null;
  status: string;
  contractValue: number;
  totalPaid: number;
  totalCost: number;
  remainingBill: number;
  profit: number;
  paymentStatus: string;
  isOverdue: boolean;
  notes: string | null;
};

export type JobLedgerEntry = {
  id: string;
  jobId: string;
  date: string;
  amount: number;
};

export type JobDetail = JobSummary & {
  costs: Array<JobLedgerEntry & { description: string }>;
  payments: Array<JobLedgerEntry & { type: string }>;
};

export type Host = {
  id: string;
  name: string;
  phone: string | null;
  commissionType: string;
  rate: number;
  isActive: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  whatsapp: string | null;
  category: string | null;
  city: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  products: SupplierProduct[];
};

export type SupplierProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  totalSold: number;
  transactionCount: number;
  revenue: number;
};

export type LiveSessionRow = {
  id: string;
  hostId: string;
  hostName: string;
  storeId: string;
  storeName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  totalOrders: number;
  totalRevenue: number;
  commissionAmount: number;
  commissionPaid: boolean;
  notes: string | null;
};

export type LedgerMonth = {
  month: string;
  jobIncome: number;
  jobCost: number;
  jobProfit: number;
  posRevenue: number;
  posCost: number;
  posProfit: number;
  netProfit: number;
};

export type DashboardTrendPoint = { month: string; posRevenue: number; posProfit: number };

export type DashboardSummary = {
  month: string;
  posRevenue: number;
  posProfit: number;
  profitTrend: DashboardTrendPoint[];
  recentSales: SaleRow[];
};

export type AppModule = {
  key: string;
  label: string;
  description: string;
  isEnabled: boolean;
  isCore: boolean;
  sortOrder: number;
};

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
  topProducts?: Array<{
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

export type SalesReportSort = 'pcs' | 'revenue' | 'profit' | 'margin';

export type SalesMetrics = {
  pcs: number;
  transactions: number;
  revenue: number;
  hpp: number;
  platformFee: number;
  discount: number;
  profit: number;
  margin: number;
};

export type SalesReportProduct = SalesMetrics & {
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  channel: string;
  pcsShare: number;
  revenueShare: number;
};

export type SalesReport = {
  month: string | null;
  totals: SalesMetrics & { averageOrder: number; activeProducts: number };
  products: SalesReportProduct[];
  channels: Array<
    SalesMetrics & { storeId: string; storeName: string; channel: string; revenueShare: number }
  >;
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
