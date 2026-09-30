'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastIcon, type ToastKind } from '@/components/toast-icons';
import type {
  DashboardSummary,
  AppModule,
  Host,
  InvoiceDetail,
  InvoiceRow,
  JobDetail,
  JobSummary,
  LedgerMonth,
  LiveSessionRow,
  MetaAdTestRow,
  ProductRow,
  SaleRow,
  SalesReport,
  SalesReportSort,
  SettlementRow,
  StorePerformanceReport,
  TaskRow,
  StoreRow,
  Supplier,
  CrmAlertsResponse,
  CrmClientRow,
  CrmLeadsResponse,
  CrmProductRow,
} from './types';

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

function buildUrl(path: string, params?: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return `/api${path}${query ? `?${query}` : ''}`;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, unknown>;
    // Diteruskan dari signal React Query. Tanpa ini, ganti halaman/filter
    // dengan cepat tidak membatalkan request lama — request itu tetap
    // berjalan sampai selesai dan terus menahan koneksi DB yang jumlahnya
    // terbatas, membuat halaman BERIKUTNYA ikut menunggu.
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error ?? `Request gagal (${response.status})`);
  }

  return (await response.json()) as T;
}

async function compressProductImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Foto tidak bisa diproses.'))),
      'image/webp',
      0.82,
    );
  });
}

export async function uploadImage(
  file: File,
  kind: 'product' | 'supplier' | 'sale' | 'invoice' | 'store' | 'host',
): Promise<{ url: string }> {
  const compressed = await compressProductImage(file);
  const formData = new FormData();
  formData.append('file', compressed, 'product.webp');
  formData.append('kind', kind);

  const response = await fetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error ?? `Upload foto gagal (${response.status})`);
  }
  return (await response.json()) as { url: string };
}

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  return uploadImage(file, 'product');
}

/** Logo/foto brand toko & kanal. */
export async function uploadStoreImage(file: File): Promise<{ url: string }> {
  return uploadImage(file, 'store');
}

/** Foto host live selling. */
export async function uploadHostImage(file: File): Promise<{ url: string }> {
  return uploadImage(file, 'host');
}

/* ------------------------------------------------------------------ */
/* query keys                                                          */
/* ------------------------------------------------------------------ */

export const getGetDashboardSummaryQueryKey = (params?: { month?: string }) =>
  ['dashboard', params ?? {}] as const;
export const getListStoresQueryKey = () => ['stores'] as const;
export const getListProductsQueryKey = (params?: { activeOnly?: boolean; storeId?: string }) =>
  ['products', params ?? {}] as const;
export const getListSalesQueryKey = (params?: { month?: string; storeId?: string }) =>
  ['sales', params ?? {}] as const;
export const getListMetaAdTestsQueryKey = (params?: { status?: string }) =>
  ['meta-ads', params ?? {}] as const;
export const getListJobsQueryKey = (params?: { status?: string; attentionOnly?: boolean }) =>
  ['jobs', params ?? {}] as const;
export const getGetJobQueryKey = (jobId: string) => ['jobs', jobId] as const;
export const getListHostsQueryKey = () => ['hosts'] as const;
export const getListSuppliersQueryKey = () => ['suppliers'] as const;
export const getListLiveSessionsQueryKey = (params?: { period?: string }) =>
  ['live-sessions', params ?? {}] as const;
export const getListLedgerQueryKey = () => ['ledger'] as const;
export const getListModulesQueryKey = () => ['modules'] as const;
export const getSalesReportQueryKey = (params?: SalesReportParams) =>
  ['sales-report', params ?? {}] as const;
export const getStorePerformanceQueryKey = (params?: { month?: string }) =>
  ['store-performance', params ?? {}] as const;

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

export function useGetDashboardSummary(params: { month?: string } = {}) {
  return useQuery({
    queryKey: getGetDashboardSummaryQueryKey(params),
    queryFn: ({ signal }) => request<DashboardSummary>('/dashboard', { params, signal }),
    // Sinkron ulang tiap 60 detik selama halaman terbuka, senada dengan
    // banner insight — supaya tidak nyangkut kalau tab dibiarkan lama.
    refetchInterval: 60_000,
  });
}

export function useListStores() {
  return useQuery({
    queryKey: getListStoresQueryKey(),
    queryFn: ({ signal }) => request<StoreRow[]>('/stores', { signal }),
  });
}

export const getListSettlementsQueryKey = (month: string) => ['settlements', month] as const;

/** Status pencairan dana marketplace per toko untuk satu bulan (Fase 5). */
export function useListSettlements(month: string) {
  return useQuery({
    queryKey: getListSettlementsQueryKey(month),
    queryFn: ({ signal }) => request<SettlementRow[]>('/settlements', { params: { month }, signal }),
  });
}

/** Upsert status pencairan untuk satu toko satu bulan. */
export function useUpdateSettlement(options?: MutationOpts<unknown, { storeId: string; month: string; data: unknown }>) {
  return useInvalidating(
    ({ storeId, month, data }) =>
      request<unknown>(`/settlements/${storeId}`, { method: 'PATCH', params: { month }, body: data }),
    ['settlements'],
    options,
    { kind: 'paid', message: 'Status pencairan disimpan' },
  );
}

/* ------------------------------- invoices ------------------------------- */

export const getListInvoicesQueryKey = () => ['invoices'] as const;
export const getGetInvoiceQueryKey = (invoiceId: string) => ['invoices', invoiceId] as const;

/** Daftar ringkas invoice custom (Fase 6). */
export function useListInvoices() {
  return useQuery({
    queryKey: getListInvoicesQueryKey(),
    queryFn: ({ signal }) => request<InvoiceRow[]>('/invoices', { signal }),
  });
}

/** Detail invoice + item + pembayaran untuk halaman cetak. */
export function useGetInvoice(invoiceId: string) {
  return useQuery({
    queryKey: getGetInvoiceQueryKey(invoiceId),
    queryFn: ({ signal }) => request<InvoiceDetail>(`/invoices/${invoiceId}`, { signal }),
    enabled: Boolean(invoiceId),
  });
}

export function useCreateInvoice(options?: MutationOpts<unknown, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<unknown>('/invoices', { method: 'POST', body: data }),
    ['invoices'],
    options,
    { kind: 'created', message: 'Invoice berhasil dibuat' },
  );
}

export function useUpdateInvoice(
  options?: MutationOpts<unknown, { invoiceId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ invoiceId, data }) =>
      request<unknown>(`/invoices/${invoiceId}`, { method: 'PATCH', body: data }),
    ['invoices'],
    options,
    { kind: 'updated', message: 'Invoice diperbarui' },
  );
}

export function useDeleteInvoice(options?: MutationOpts<unknown, { invoiceId: string }>) {
  return useInvalidating(
    ({ invoiceId }) =>      request<unknown>(`/invoices/${invoiceId}`, { method: 'DELETE' }),
    ['invoices'],
    options,
    { kind: 'deleted', message: 'Invoice dihapus' },
  );
}

/* --------------------------------- kanban -------------------------------- */

export const getListTasksQueryKey = () => ['tasks'] as const;

/** Kartu kanban tugas bebas (todo/doing/done). */
export function useListTasks() {
  return useQuery({
    queryKey: getListTasksQueryKey(),
    queryFn: ({ signal }) => request<TaskRow[]>('/tasks', { signal }),
  });
}

export function useCreateTask(options?: MutationOpts<TaskRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<TaskRow>('/tasks', { method: 'POST', body: data }),
    ['tasks'],
    options,
    { kind: 'created', message: 'Tugas ditambahkan ke kanban' },
  );
}

export function useUpdateTask(
  options?: MutationOpts<TaskRow, { taskId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ taskId, data }) =>
      request<TaskRow>(`/tasks/${taskId}`, { method: 'PATCH', body: data }),
    ['tasks'],
    options,
    { kind: 'updated', message: 'Tugas diperbarui' },
  );
}

export function useDeleteTask(options?: MutationOpts<unknown, { taskId: string }>) {
  return useInvalidating(
    ({ taskId }) =>      request<unknown>(`/tasks/${taskId}`, { method: 'DELETE' }),
    ['tasks'],
    options,
    { kind: 'deleted', message: 'Tugas dihapus' },
  );
}

export function useListProducts(params: { activeOnly?: boolean; storeId?: string } = {}) {
  return useQuery({
    queryKey: getListProductsQueryKey(params),
    queryFn: ({ signal }) => request<ProductRow[]>('/products', { params, signal }),
  });
}

export function useListSales(params: { month?: string; storeId?: string } = {}) {
  return useQuery({
    queryKey: getListSalesQueryKey(params),
    queryFn: ({ signal }) => request<SaleRow[]>('/sales', { params, signal }),
  });
}

export function useListMetaAdTests(params: { status?: string } = {}) {
  return useQuery({
    queryKey: getListMetaAdTestsQueryKey(params),
    queryFn: ({ signal }) => request<MetaAdTestRow[]>('/meta-ads', { params, signal }),
  });
}

export function useListJobs(params: { status?: string; attentionOnly?: boolean } = {}) {
  return useQuery({
    queryKey: getListJobsQueryKey(params),
    queryFn: ({ signal }) => request<JobSummary[]>('/jobs', { params, signal }),
  });
}

export function useGetJob(jobId: string) {
  return useQuery({
    queryKey: getGetJobQueryKey(jobId),
    queryFn: ({ signal }) => request<JobDetail>(`/jobs/${jobId}`, { signal }),
    enabled: Boolean(jobId),
  });
}

export function useListHosts() {
  return useQuery({
    queryKey: getListHostsQueryKey(),
    queryFn: ({ signal }) => request<Host[]>('/hosts', { signal }),
  });
}

export function useListSuppliers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: getListSuppliersQueryKey(),
    queryFn: ({ signal }) => request<Supplier[]>('/suppliers', { signal }),
    enabled: options.enabled ?? true,
  });
}

export function useListLiveSessions(params: { period?: string } = {}) {
  return useQuery({
    queryKey: getListLiveSessionsQueryKey(params),
    queryFn: ({ signal }) => request<LiveSessionRow[]>('/live-sessions', { params, signal }),
  });
}

export type SalesReportParams = {
  /** YYYY-MM; kosong = akumulasi seluruh waktu. */
  month?: string;
  /** "YYYY-Www" | "YYYY-MM" | "YYYY" — filter mingguan/bulanan/tahunan; menang atas `month`. */
  period?: string;
  brand?: string;
  storeId?: string;
  sort?: SalesReportSort;
};

/** Ringkasan + peringkat produk + tren harian untuk satu filter toko/periode. */
export function useSalesReport(params: SalesReportParams = {}) {
  return useQuery({
    queryKey: getSalesReportQueryKey(params),
    queryFn: ({ signal }) => {
      if (params.period) {
        // Mode periode tidak memakai param month sama sekali.
        const { month: _month, ...rest } = params;
        return request<SalesReport>('/reports/sales', { params: rest, signal });
      }
      return request<SalesReport>('/reports/sales', {
        params: { ...params, month: params.month || 'all' },
        signal,
      });
    },
    // Tampilkan data filter sebelumnya sementara filter baru dimuat, supaya halaman tidak berkedip.
    placeholderData: keepPreviousData,
  });
}

export function useStorePerformance(
  params: { month?: string } = {},
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: getStorePerformanceQueryKey(params),
    queryFn: ({ signal }) => request<StorePerformanceReport>('/reports/stores', { params, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
  });
}

export function useListLedger() {
  return useQuery({
    queryKey: getListLedgerQueryKey(),
    queryFn: ({ signal }) => request<LedgerMonth[]>('/reports/ledger', { signal }),
  });
}

export function useListModules() {
  return useQuery({
    queryKey: getListModulesQueryKey(),
    queryFn: ({ signal }) => request<AppModule[]>('/modules', { signal }),
  });
}

/* ------------------------------------------------------------------ */
/* mutations                                                           */
/* ------------------------------------------------------------------ */

type MutationOpts<TData, TVars> = Omit<
  UseMutationOptions<TData, Error, TVars>,
  'mutationFn'
>;

/**
 * Toast sukses ala perbankan: setiap mutation menyebut pesan + jenis ikonnya
 * (ceklis/pensil/trash/badge). `false` = tanpa toast. Pesan boleh fungsi dari
 * variables, mis. untuk toggle modul (aktif/nonaktif).
 */
type MutationToast<TVars> =
  | { kind: ToastKind; message: string | ((variables: TVars) => string) }
  | ((variables: TVars) => { kind: ToastKind; message: string })
  | false;

/** Invalidates every key whose first segment matches, so lists refresh after a write. */
function useInvalidating<TData, TVars>(
  mutationFn: (variables: TVars) => Promise<TData>,
  scopes: string[],
  options?: MutationOpts<TData, TVars>,
  toastMeta?: MutationToast<TVars>,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    ...options,
    // Tanpa ini, kegagalan simpan hanya membuat tombol berhenti loading tanpa
    // pesan apa pun — pengguna mengira datanya tersimpan padahal tidak.
    onError: (...args: Parameters<NonNullable<typeof options>['onError'] & object>) => {
      toast.error(args[0]?.message || 'Gagal menyimpan. Coba lagi.');
      options?.onError?.(...args);
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      for (const scope of scopes) {
        queryClient.invalidateQueries({ queryKey: [scope] });
      }
      if (toastMeta !== false && toastMeta) {
        const resolved = typeof toastMeta === 'function' ? toastMeta(variables) : toastMeta;
        const message =
          typeof resolved.message === 'function' ? resolved.message(variables) : resolved.message;
        toast.success(message || 'Berhasil disimpan', { icon: toastIcon(resolved.kind) });
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateStore(options?: MutationOpts<StoreRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<StoreRow>('/stores', { method: 'POST', body: data }),
    ['stores', 'products', 'sales-report', 'store-performance'],
    options,
    { kind: 'created', message: 'Toko berhasil ditambahkan' },
  );
}

export function useUpdateStore(
  options?: MutationOpts<StoreRow, { storeId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ storeId, data }) =>
      request<StoreRow>(`/stores/${storeId}`, { method: 'PATCH', body: data }),
    ['stores', 'products', 'sales-report', 'store-performance'],
    options,
    { kind: 'updated', message: 'Toko diperbarui' },
  );
}

export function useDeleteStore(options?: MutationOpts<{ ok: boolean }, { storeId: string }>) {
  return useInvalidating(
    ({ storeId }) =>      request<{ ok: boolean }>(`/stores/${storeId}`, { method: 'DELETE' }),
    ['stores', 'products', 'dashboard', 'sales-report', 'store-performance'],
    options,
    { kind: 'deleted', message: 'Toko dihapus' },
  );
}

export function useCreateProduct(options?: MutationOpts<ProductRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<ProductRow>('/products', { method: 'POST', body: data }),
    ['products', 'stores', 'suppliers', 'sales-report', 'store-performance'],
    options,
    { kind: 'created', message: 'Produk berhasil ditambahkan' },
  );
}

export function useUpdateProduct(
  options?: MutationOpts<ProductRow, { productId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ productId, data }) =>
      request<ProductRow>(`/products/${productId}`, { method: 'PATCH', body: data }),
    ['products', 'suppliers', 'sales-report', 'store-performance'],
    options,
    { kind: 'updated', message: 'Produk diperbarui' },
  );
}

export function useDeleteProduct(
  options?: MutationOpts<{ ok: boolean }, { productId: string }>,
) {
  return useInvalidating(
    ({ productId }) =>      request<{ ok: boolean }>(`/products/${productId}`, { method: 'DELETE' }),
    ['products', 'stores', 'suppliers', 'sales-report', 'store-performance'],
    options,
    { kind: 'deleted', message: 'Produk dihapus' },
  );
}

export function useCreateSale(options?: MutationOpts<SaleRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<SaleRow>('/sales', { method: 'POST', body: data }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance', 'products'],
    options,
    { kind: 'created', message: 'Penjualan tercatat' },
  );
}

export function useUpdateSale(
  options?: MutationOpts<SaleRow, { saleId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ saleId, data }) =>      request<SaleRow>(`/sales/${saleId}`, { method: 'PATCH', body: data }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance', 'products'],
    options,
    { kind: 'updated', message: 'Penjualan diperbarui' },
  );
}

export function useDeleteSale(options?: MutationOpts<{ ok: boolean }, { saleId: string }>) {
  return useInvalidating(
    ({ saleId }) =>      request<{ ok: boolean }>(`/sales/${saleId}`, { method: 'DELETE' }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance', 'products'],
    options,
    { kind: 'deleted', message: 'Penjualan dihapus' },
  );
}

export function useCreateMetaAdTest(options?: MutationOpts<MetaAdTestRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<MetaAdTestRow>('/meta-ads', { method: 'POST', body: data }),
    ['meta-ads'],
    options,
    { kind: 'created', message: 'Test iklan Meta ditambahkan' },
  );
}

export function useUpdateMetaAdTest(
  options?: MutationOpts<MetaAdTestRow, { metaAdTestId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ metaAdTestId, data }) =>
      request<MetaAdTestRow>(`/meta-ads/${metaAdTestId}`, { method: 'PATCH', body: data }),
    ['meta-ads'],
    options,
    { kind: 'updated', message: 'Test iklan diperbarui' },
  );
}

export function useDeleteMetaAdTest(
  options?: MutationOpts<{ ok: boolean }, { metaAdTestId: string }>,
) {
  return useInvalidating(
    ({ metaAdTestId }) =>
      request<{ ok: boolean }>(`/meta-ads/${metaAdTestId}`, { method: 'DELETE' }),
    ['meta-ads'],
    options,
    { kind: 'deleted', message: 'Test iklan dihapus' },
  );
}

export function useCreateJob(options?: MutationOpts<JobSummary, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<JobSummary>('/jobs', { method: 'POST', body: data }),
    ['jobs', 'dashboard'],
    options,
    { kind: 'created', message: 'Job freelance ditambahkan' },
  );
}

export function useDeleteJob(options?: MutationOpts<{ ok: boolean }, { jobId: string }>) {
  return useInvalidating(
    ({ jobId }) =>      request<{ ok: boolean }>(`/jobs/${jobId}`, { method: 'DELETE' }),
    ['jobs', 'dashboard', 'ledger'],
    options,
    { kind: 'deleted', message: 'Job dihapus' },
  );
}

export function useUpdateJob(
  options?: MutationOpts<JobSummary, { jobId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ jobId, data }) =>
      request<JobSummary>(`/jobs/${jobId}`, { method: 'PATCH', body: data }),
    ['jobs', 'dashboard'],
    options,
    { kind: 'updated', message: 'Job diperbarui' },
  );
}

export function useCreateJobCost(
  options?: MutationOpts<unknown, { jobId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ jobId, data }) =>      request(`/jobs/${jobId}/costs`, { method: 'POST', body: data }),
    ['jobs', 'dashboard', 'ledger'],
    options,
    { kind: 'created', message: 'Biaya job dicatat' },
  );
}

export function useCreateJobPayment(
  options?: MutationOpts<unknown, { jobId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ jobId, data }) =>      request(`/jobs/${jobId}/payments`, { method: 'POST', body: data }),
    ['jobs', 'dashboard', 'ledger'],
    options,
    { kind: 'created', message: 'Pembayaran job dicatat' },
  );
}

export function useCreateHost(options?: MutationOpts<Host, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<Host>('/hosts', { method: 'POST', body: data }),
    ['hosts'],
    options,
    { kind: 'created', message: 'Host berhasil ditambahkan' },
  );
}

export function useUpdateHost(
  options?: MutationOpts<Host, { hostId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ hostId, data }) =>      request<Host>(`/hosts/${hostId}`, { method: 'PATCH', body: data }),
    ['hosts', 'live-sessions'],
    options,
    { kind: 'updated', message: 'Host diperbarui' },
  );
}

export function useDeleteHost(options?: MutationOpts<{ ok: boolean }, { hostId: string }>) {
  return useInvalidating(
    ({ hostId }) =>      request<{ ok: boolean }>(`/hosts/${hostId}`, { method: 'DELETE' }),
    ['hosts', 'live-sessions'],
    options,
    { kind: 'deleted', message: 'Host dihapus' },
  );
}

export function useCreateSupplier(options?: MutationOpts<Supplier, { data: unknown }>) {
  return useInvalidating(
    ({ data }) =>      request<Supplier>('/suppliers', { method: 'POST', body: data }),
    ['suppliers', 'products'],
    options,
    { kind: 'created', message: 'Suplier berhasil ditambahkan' },
  );
}

export function useUpdateSupplier(
  options?: MutationOpts<Supplier, { supplierId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ supplierId, data }) =>      request<Supplier>(`/suppliers/${supplierId}`, { method: 'PATCH', body: data }),
    ['suppliers', 'products'],
    options,
    { kind: 'updated', message: 'Suplier diperbarui' },
  );
}

export function useDeleteSupplier(options?: MutationOpts<{ ok: boolean }, { supplierId: string }>) {
  return useInvalidating(
    ({ supplierId }) =>      request<{ ok: boolean }>(`/suppliers/${supplierId}`, { method: 'DELETE' }),
    ['suppliers', 'products'],
    options,
    { kind: 'deleted', message: 'Suplier dihapus' },
  );
}

export function useCreateLiveSession(
  options?: MutationOpts<LiveSessionRow, { data: unknown }>,
) {
  return useInvalidating(
    ({ data }) =>      request<LiveSessionRow>('/live-sessions', { method: 'POST', body: data }),
    ['live-sessions', 'dashboard'],
    options,
    { kind: 'created', message: 'Sesi live tercatat' },
  );
}

export function useDeleteLiveSession(
  options?: MutationOpts<{ ok: boolean }, { liveSessionId: string }>,
) {
  return useInvalidating(
    ({ liveSessionId }) =>
      request<{ ok: boolean }>(`/live-sessions/${liveSessionId}`, { method: 'DELETE' }),
    ['live-sessions', 'dashboard'],
    options,
    { kind: 'deleted', message: 'Sesi live dihapus' },
  );
}

export function useUpdateModule(
  options?: MutationOpts<AppModule, { key: string; isEnabled: boolean }>,
) {
  return useInvalidating(
    ({ key, isEnabled }) =>
      request<AppModule>(`/modules?key=${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: { isEnabled },
      }),
    ['modules'],
    options,
    (variables) => ({
      kind: 'toggled',
      message: variables.isEnabled ? 'Modul diaktifkan' : 'Modul dinonaktifkan',
    }),
  );
}
export function useUpdateLiveSession(
  options?: MutationOpts<LiveSessionRow, { liveSessionId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ liveSessionId, data }) =>
      request<LiveSessionRow>(`/live-sessions/${liveSessionId}`, {
        method: 'PATCH',
        body: data,
      }),
    ['live-sessions', 'dashboard'],
    options,
    (variables) =>
      (variables.data as { commissionPaid?: boolean } | undefined)?.commissionPaid
        ? { kind: 'paid' as const, message: 'Komisi host ditandai dibayar' }
        : { kind: 'updated' as const, message: 'Sesi live diperbarui' },
  );
}


/* ------------------------------------------------------------------ */
/* CRM Leads                                                           */
/* ------------------------------------------------------------------ */

export const getListCrmClientsQueryKey = () => ['crm-clients'] as const;
export const getListCrmProductsQueryKey = (params?: { clientId?: string }) =>
  ['crm-products', params ?? {}] as const;
export const getListCrmLeadsQueryKey = (params?: Record<string, unknown>) =>
  ['crm-leads', params ?? {}] as const;
export const getCrmAlertsQueryKey = () => ['crm-alerts'] as const;

export function useListCrmClients() {
  return useQuery({
    queryKey: getListCrmClientsQueryKey(),
    queryFn: ({ signal }) => request<CrmClientRow[]>('/crm/clients', { signal }),
  });
}

export function useListCrmProducts(params: { clientId?: string } = {}) {
  return useQuery({
    queryKey: getListCrmProductsQueryKey(params),
    queryFn: ({ signal }) => request<CrmProductRow[]>('/crm/products', { params, signal }),
  });
}

export function useListCrmLeads(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: getListCrmLeadsQueryKey(params),
    queryFn: ({ signal }) => request<CrmLeadsResponse>('/crm/leads', { params, signal }),
  });
}

/** Lonceng notifikasi: polling 30 detik selama dashboard terbuka. */
export function useCrmAlerts() {
  return useQuery({
    queryKey: getCrmAlertsQueryKey(),
    queryFn: ({ signal }) => request<CrmAlertsResponse>('/crm/alerts', { signal }),
    refetchInterval: 30_000,
  });
}

/** Invalidasi seluruh cache CRM sekaligus (leads, produk, klien, alerts). */
function useInvalidateCrm<TVars>(
  mutateFn: (vars: TVars) => Promise<unknown>,
  options?: MutationOpts<unknown, TVars>,
  toastMeta?: MutationToast<TVars>,
) {
  return useInvalidating(
    mutateFn,
    ['crm-leads', 'crm-products', 'crm-clients', 'crm-alerts'],
    options,
    toastMeta,
  );
}

export function useCreateCrmClient(options?: MutationOpts<unknown, { data: unknown }>) {
  return useInvalidateCrm(
    ({ data }) => request('/crm/clients', { method: 'POST', body: data }),
    options,
    { kind: 'created', message: 'Klien CRM ditambahkan' },
  );
}

export function useUpdateCrmClient(
  options?: MutationOpts<unknown, { clientId: string; data: unknown }>,
) {
  return useInvalidateCrm(
    ({ clientId, data }) => request(`/crm/clients/${clientId}`, { method: 'PATCH', body: data }),
    options,
    { kind: 'updated', message: 'Klien CRM diperbarui' },
  );
}

export function useDeleteCrmClient(options?: MutationOpts<unknown, { clientId: string }>) {
  return useInvalidateCrm(
    ({ clientId }) => request(`/crm/clients/${clientId}`, { method: 'DELETE' }),
    options,
    { kind: 'deleted', message: 'Klien CRM dihapus' },
  );
}

export function useCreateCrmProduct(options?: MutationOpts<unknown, { data: unknown }>) {
  return useInvalidateCrm(
    ({ data }) => request('/crm/products', { method: 'POST', body: data }),
    options,
    { kind: 'created', message: 'Produk CRM ditambahkan' },
  );
}

export function useUpdateCrmProduct(
  options?: MutationOpts<unknown, { productId: string; data: unknown }>,
) {
  return useInvalidateCrm(
    ({ productId, data }) => request(`/crm/products/${productId}`, { method: 'PATCH', body: data }),
    options,
    { kind: 'updated', message: 'Produk CRM diperbarui' },
  );
}

export function useDeleteCrmProduct(options?: MutationOpts<unknown, { productId: string }>) {
  return useInvalidateCrm(
    ({ productId }) => request(`/crm/products/${productId}`, { method: 'DELETE' }),
    options,
    { kind: 'deleted', message: 'Produk CRM dihapus' },
  );
}

export function useCreateCrmLead(options?: MutationOpts<unknown, { data: unknown }>) {
  return useInvalidateCrm(
    ({ data }) => request('/crm/leads', { method: 'POST', body: data }),
    options,
    { kind: 'created', message: 'Lead ditambahkan ke pipeline' },
  );
}

export function useUpdateCrmLead(
  options?: MutationOpts<unknown, { leadId: string; data: unknown }>,
) {
  return useInvalidateCrm(
    ({ leadId, data }) => request(`/crm/leads/${leadId}`, { method: 'PATCH', body: data }),
    options,
    { kind: 'updated', message: 'Lead diperbarui' },
  );
}

export function useDeleteCrmLead(options?: MutationOpts<unknown, { leadId: string }>) {
  return useInvalidateCrm(
    ({ leadId }) => request(`/crm/leads/${leadId}`, { method: 'DELETE' }),
    options,
    { kind: 'deleted', message: 'Lead dihapus' },
  );
}

/* ------------------------------------------------------------------ */
/* sesi login                                                          */
/* ------------------------------------------------------------------ */

export type SessionUser = { id: string; email: string; name: string; role: 'owner' | 'demo' };

/**
 * Satu-satunya tempat membaca sesi. Sebelumnya AppShell dan halaman Pengaturan
 * memakai query key 'session' yang sama dengan bentuk data berbeda, sehingga
 * Pengaturan crash ("Cannot read properties of undefined (reading 'role')").
 */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionUser | null> => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) return null;
      const body = (await response.json()) as { user?: SessionUser };
      return body.user ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
