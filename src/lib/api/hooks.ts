'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  DashboardSummary,
  AppModule,
  Host,
  JobDetail,
  JobSummary,
  LedgerMonth,
  LiveSessionRow,
  MetaAdTestRow,
  ProductRow,
  SaleRow,
  SalesReport,
  SalesReportSort,
  StorePerformanceReport,
  StoreRow,
  Supplier,
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
  kind: 'product' | 'supplier' | 'sale',
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
export const getListLiveSessionsQueryKey = (params?: { month?: string }) =>
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
  });
}

export function useListStores() {
  return useQuery({
    queryKey: getListStoresQueryKey(),
    queryFn: ({ signal }) => request<StoreRow[]>('/stores', { signal }),
  });
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

export function useListLiveSessions(params: { month?: string } = {}) {
  return useQuery({
    queryKey: getListLiveSessionsQueryKey(params),
    queryFn: ({ signal }) => request<LiveSessionRow[]>('/live-sessions', { params, signal }),
  });
}

export type SalesReportParams = {
  /** YYYY-MM; kosong = akumulasi seluruh waktu. */
  month?: string;
  brand?: string;
  storeId?: string;
  sort?: SalesReportSort;
};

/** Ringkasan + peringkat produk + tren harian untuk satu filter toko/periode. */
export function useSalesReport(params: SalesReportParams = {}) {
  return useQuery({
    queryKey: getSalesReportQueryKey(params),
    queryFn: ({ signal }) =>
      request<SalesReport>('/reports/sales', {
        params: { ...params, month: params.month || 'all' },
        signal,
      }),
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

/** Invalidates every key whose first segment matches, so lists refresh after a write. */
function useInvalidating<TData, TVars>(
  mutationFn: (variables: TVars) => Promise<TData>,
  scopes: string[],
  options?: MutationOpts<TData, TVars>,
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
    onSuccess: (...args: Parameters<NonNullable<typeof options>['onSuccess'] & object>) => {
      for (const scope of scopes) {
        queryClient.invalidateQueries({ queryKey: [scope] });
      }
      options?.onSuccess?.(...args);
    },
  });
}

export function useCreateStore(options?: MutationOpts<StoreRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<StoreRow>('/stores', { method: 'POST', body: data }),
    ['stores', 'products', 'sales-report', 'store-performance'],
    options,
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
  );
}

export function useDeleteStore(options?: MutationOpts<{ ok: boolean }, { storeId: string }>) {
  return useInvalidating(
    ({ storeId }) => request<{ ok: boolean }>(`/stores/${storeId}`, { method: 'DELETE' }),
    ['stores', 'products', 'dashboard', 'sales-report', 'store-performance'],
    options,
  );
}

export function useCreateProduct(options?: MutationOpts<ProductRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<ProductRow>('/products', { method: 'POST', body: data }),
    ['products', 'stores', 'suppliers', 'sales-report', 'store-performance'],
    options,
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
  );
}

export function useDeleteProduct(
  options?: MutationOpts<{ ok: boolean }, { productId: string }>,
) {
  return useInvalidating(
    ({ productId }) => request<{ ok: boolean }>(`/products/${productId}`, { method: 'DELETE' }),
    ['products', 'stores', 'suppliers', 'sales-report', 'store-performance'],
    options,
  );
}

export function useCreateSale(options?: MutationOpts<SaleRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<SaleRow>('/sales', { method: 'POST', body: data }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance'],
    options,
  );
}

export function useUpdateSale(
  options?: MutationOpts<SaleRow, { saleId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ saleId, data }) => request<SaleRow>(`/sales/${saleId}`, { method: 'PATCH', body: data }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance'],
    options,
  );
}

export function useDeleteSale(options?: MutationOpts<{ ok: boolean }, { saleId: string }>) {
  return useInvalidating(
    ({ saleId }) => request<{ ok: boolean }>(`/sales/${saleId}`, { method: 'DELETE' }),
    ['sales', 'dashboard', 'ledger', 'sales-report', 'store-performance'],
    options,
  );
}

export function useCreateMetaAdTest(options?: MutationOpts<MetaAdTestRow, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<MetaAdTestRow>('/meta-ads', { method: 'POST', body: data }),
    ['meta-ads'],
    options,
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
  );
}

export function useCreateJob(options?: MutationOpts<JobSummary, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<JobSummary>('/jobs', { method: 'POST', body: data }),
    ['jobs', 'dashboard'],
    options,
  );
}

export function useDeleteJob(options?: MutationOpts<{ ok: boolean }, { jobId: string }>) {
  return useInvalidating(
    ({ jobId }) => request<{ ok: boolean }>(`/jobs/${jobId}`, { method: 'DELETE' }),
    ['jobs', 'dashboard', 'ledger'],
    options,
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
  );
}

export function useCreateJobCost(
  options?: MutationOpts<unknown, { jobId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ jobId, data }) => request(`/jobs/${jobId}/costs`, { method: 'POST', body: data }),
    ['jobs', 'dashboard', 'ledger'],
    options,
  );
}

export function useCreateJobPayment(
  options?: MutationOpts<unknown, { jobId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ jobId, data }) => request(`/jobs/${jobId}/payments`, { method: 'POST', body: data }),
    ['jobs', 'dashboard', 'ledger'],
    options,
  );
}

export function useCreateHost(options?: MutationOpts<Host, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<Host>('/hosts', { method: 'POST', body: data }),
    ['hosts'],
    options,
  );
}

export function useUpdateHost(
  options?: MutationOpts<Host, { hostId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ hostId, data }) => request<Host>(`/hosts/${hostId}`, { method: 'PATCH', body: data }),
    ['hosts', 'live-sessions'],
    options,
  );
}

export function useDeleteHost(options?: MutationOpts<{ ok: boolean }, { hostId: string }>) {
  return useInvalidating(
    ({ hostId }) => request<{ ok: boolean }>(`/hosts/${hostId}`, { method: 'DELETE' }),
    ['hosts', 'live-sessions'],
    options,
  );
}

export function useCreateSupplier(options?: MutationOpts<Supplier, { data: unknown }>) {
  return useInvalidating(
    ({ data }) => request<Supplier>('/suppliers', { method: 'POST', body: data }),
    ['suppliers'],
    options,
  );
}

export function useUpdateSupplier(
  options?: MutationOpts<Supplier, { supplierId: string; data: unknown }>,
) {
  return useInvalidating(
    ({ supplierId, data }) => request<Supplier>(`/suppliers/${supplierId}`, { method: 'PATCH', body: data }),
    ['suppliers'],
    options,
  );
}

export function useDeleteSupplier(options?: MutationOpts<{ ok: boolean }, { supplierId: string }>) {
  return useInvalidating(
    ({ supplierId }) => request<{ ok: boolean }>(`/suppliers/${supplierId}`, { method: 'DELETE' }),
    ['suppliers'],
    options,
  );
}

export function useCreateLiveSession(
  options?: MutationOpts<LiveSessionRow, { data: unknown }>,
) {
  return useInvalidating(
    ({ data }) => request<LiveSessionRow>('/live-sessions', { method: 'POST', body: data }),
    ['live-sessions', 'dashboard'],
    options,
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
