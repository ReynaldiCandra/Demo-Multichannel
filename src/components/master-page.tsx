'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBulkDeleteProducts,
  useBulkUpdateProducts,
  useCreateProduct,
  useCreateStore,
  useDeleteProduct,
  useDeleteStore,
  useListProducts,
  useListStores,
  useListSuppliers,
  useUpdateProduct,
  useUpdateStore,
  uploadProductImage,
  uploadStoreImage,
} from '@/lib/api/hooks';
import type { ProductRow, StoreRow } from '@/lib/api/types';
import { ProductForm } from '@/components/product-form';
import { useProfitSettings } from '@/lib/api/hooks';
import { Badge, Button, ConfirmDialog, Field, ImagePreviewButton, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';

/** Konfirmasi request yang mungkin punya action spesifik (mis. view-target). */
type ConfirmAction = { action: 'view-target'; product: (
  | { target: number; mode: 'volume'; minSellingPrice: number; meetsTarget: boolean; meta: string; batchQty: number }
  | { target: number; mode: 'per_pcs'; minSellingPrice: number; meetsTarget: boolean; meta: string; batchQty?: never }
) } | { action?: never; product?: never };
type ConfirmRequestExt = (
  | { action?: never; product?: never }
  | ConfirmAction
) & { message: string; onConfirm: () => void };

import { BulkBar, BulkCheckbox, useBulkSelection } from '@/components/bulk-selection';
import { money, number } from '@/lib/format';
import { productTargetStatus } from '@/lib/profit';

/**
 * Harga jual minimum & status target produk untuk tampil di daftar produk.
 * Pakai memo supaya tidak menghitung ulang per render; pakai key produk + nilai
 * yang berubah supaya naik ulang begitu formulir produk disimpan.
 */
function productTarget(item: ProductRow, defaultTargetPcs: number, safetyMarginPercent: number) {
  return productTargetStatus({
    hpp: item.modal,
    sellingPrice: item.sellingPrice,
    feePercent: item.feePercent,
    mode: item.profitMode,
    targetProfitPcs: item.targetProfitPcs,
    targetProfitBatch: item.targetProfitBatch,
    targetProfitBatchQty: item.targetProfitBatchQty,
    defaultTargetPcs,
    safetyMarginPercent,
  });
}

type Editing = ProductRow | StoreRow | null;
type ProductSort = 'name' | 'latest' | 'sold' | 'profit' | 'margin' | 'unsold';
type NewStoreKind = 'marketplace' | 'store';

const PRODUCT_SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'name', label: 'Nama A–Z' },
  { value: 'latest', label: 'Terbaru' },
  { value: 'sold', label: 'Terlaris' },
  { value: 'profit', label: 'Profit tertinggi' },
  { value: 'margin', label: 'Margin tertinggi' },
  { value: 'unsold', label: 'Belum laku' },
];
const PAGE_SIZE = 10;

export function MasterPage({
  kind,
  /**
   * Filter suplier awal (dari `?supplierId=` di URL). Halaman detail suplier
   * menautkan ke sini supaya produk satu suplier langsung tersaring; "none"
   * berarti produk yang belum punya suplier.
   */
  initialSupplierId,
}: {
  kind: 'products' | 'stores';
  initialSupplierId?: string;
}) {
  const isProducts = kind === 'products';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [productSort, setProductSort] = useState<ProductSort>('name');
  const [confirming, setConfirming] = useState<ConfirmRequestExt | null>(null);
  const [productStatus, setProductStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId || 'all');
  const [newStoreOpen, setNewStoreOpen] = useState(false);
  const [newStoreKind, setNewStoreKind] = useState<NewStoreKind>('store');
  const [page, setPage] = useState(1);

  const stores = useListStores();
  const products = useListProducts();
  const suppliers = useListSuppliers({ enabled: isProducts });
  const profitSettings = useProfitSettings();
  const defaultTargetPcs = profitSettings.data?.defaultTargetProfitPcs ?? 50000;
  const safetyMarginPercent = profitSettings.data?.safetyMarginPercent ?? 0;

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const createStore = useCreateStore({ onSuccess: close });
  const bulkDeleteProducts = useBulkDeleteProducts();
  const bulkUpdateProducts = useBulkUpdateProducts();
  const createStoreFromProduct = useCreateStore({
    onSuccess: (store) => {
      setNewStoreOpen(false);
      setSelectedMarketplace(store.channel);
      setSelectedStoreId(store.id);
    },
  });
  const updateStore = useUpdateStore({ onSuccess: close });
  const deleteStore = useDeleteStore();
  const createProduct = useCreateProduct({ onSuccess: close });
  const updateProduct = useUpdateProduct({ onSuccess: close });
  const deleteProduct = useDeleteProduct();

  const loading = isProducts ? products.isLoading : stores.isLoading;
  const error = isProducts ? products.isError : stores.isError;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (isProducts) {
      const imageFile = form.get('image') as File | null;
      let imageUrl = editingProduct?.imageUrl ?? null;
      try {
        if (imageFile && imageFile.size > 0) {
          imageUrl = (await uploadProductImage(imageFile)).url;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload foto gagal.');
        return;
      }

      const profitMode = (String(form.get('profitMode') || 'per_pcs') as ProductRow['profitMode']);
      const data = {
        storeId: selectedStoreId,
        supplierId: selectedSupplierId || null,
        name: String(form.get('name')),
        modal: Number(form.get('modal')),
        sellingPrice: Number(form.get('sellingPrice')),
        targetMargin: Number(form.get('targetMargin') || 0),
        // Target profit: kosong = NULL (pakai default global workspace).
        targetProfitPcs: form.get('targetProfitPcs') ? Number(form.get('targetProfitPcs')) : null,
        targetProfitBatch: profitMode === 'volume' && form.get('targetProfitBatch')
          ? Number(form.get('targetProfitBatch'))
          : null,
        targetProfitBatchQty: profitMode === 'volume' && form.get('targetProfitBatchQty')
          ? Number(form.get('targetProfitBatchQty'))
          : null,
        profitMode,
        supplierName: editingProduct?.supplierId ? null : editingProduct?.supplierName ?? null,
        supplierPhone: editingProduct?.supplierId ? null : editingProduct?.supplierPhone ?? null,
        imageUrl,
        isActive: editing ? editing.isActive : true,
      };
      if (editing) updateProduct.mutate({ productId: editing.id, data });
      else createProduct.mutate({ data });
      return;
    }

    const imageFile = form.get('image') as File | null;
    let imageUrl = editingStore?.imageUrl ?? null;
    try {
      if (imageFile && imageFile.size > 0) {
        imageUrl = (await uploadStoreImage(imageFile)).url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload logo gagal.');
      return;
    }

    const data = {
      name: String(form.get('name')),
      channel: String(form.get('channel') || '') || null,
      feePercent: Number(form.get('feePercent') || 0),
      imageUrl,
      isActive: editing ? editing.isActive : true,
    };
    if (editing) updateStore.mutate({ storeId: editing.id, data });
    else createStore.mutate({ data });
  };

  const productItems = products.data ?? [];
  const storeItems = stores.data ?? [];
  const marketplaces = useMemo(
    () => [...new Set(storeItems.map((store) => store.channel))].sort((a, b) => a.localeCompare(b)),
    [storeItems],
  );

  const visibleProducts = useMemo(() => {
    const rows = productItems.filter((item) => {
      const statusMatch =
        productStatus === 'all' ? true : productStatus === 'active' ? item.isActive : !item.isActive;
      if (!statusMatch) return false;
      if (supplierFilter === 'all') return true;
      if (supplierFilter === 'none') return !item.supplierId;
      return item.supplierId === supplierFilter;
    });
    return rows;
  }, [productItems, productSort, productStatus, supplierFilter]);
  const visibleStores = useMemo(
    () => storeItems.filter((store) => channelFilter === 'all' || store.channel === channelFilter),
    [storeItems, channelFilter],
  );
  const isEmpty = isProducts ? !visibleProducts.length : !visibleStores.length;

  const editingProduct = isProducts ? (editing as ProductRow | null) : null;
  const editingStore = isProducts ? null : (editing as StoreRow | null);

  // Seleksi massal hanya aktif di mode produk.
  const bulk = useBulkSelection();
  const visibleProductIds = useMemo(() => visibleProducts.map((item) => item.id), [visibleProducts]);
  useEffect(() => {
    bulk.prune(visibleProductIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProductIds]);
  const selectedProductIds = useMemo(() => [...bulk.selected], [bulk.selected]);
  const bulkPageIds = useMemo(
    () => visibleProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => item.id),
    [visibleProducts, page],
  );

  const bulkDeleteSelected = () =>
    setConfirming({
      message: `Hapus ${selectedProductIds.length} produk terpilih? Produk yang sudah punya penjualan akan dilewati.`,
      onConfirm: () => {
        bulkDeleteProducts.mutate(
          { ids: selectedProductIds },
          {
            onSuccess: (result) => {
              const skipped = (result as { skipped?: string[] })?.skipped ?? [];
              if (skipped.length) {
                toast.warning(
                  `${skipped.length} produk dilewati karena sudah dipakai dalam penjualan.`,
                );
              }
              bulk.clear();
            },
          },
        );
      },
    });

  const bulkSetActive = (isActive: boolean) =>
    bulkUpdateProducts.mutate(
      { ids: selectedProductIds, isActive },
      { onSuccess: () => bulk.clear() },
    );

  const openCreate = () => {
    setEditing(null);
    if (isProducts) {
      const firstChannel = marketplaces[0] ?? '';
      setSelectedMarketplace(firstChannel);
      setSelectedStoreId(storeItems.find((store) => store.channel === firstChannel && store.isActive)?.id ?? '');
      setSelectedSupplierId('');
    }
    setOpen(true);
  };

  const openEdit = (item: ProductRow | StoreRow) => {
    setEditing(item);
    if (isProducts) {
      const product = item as ProductRow;
      setSelectedMarketplace(product.channel);
      setSelectedStoreId(product.storeId);
      setSelectedSupplierId(product.supplierId ?? '');
    }
    setOpen(true);
  };

  const toggle = (item: ProductRow | StoreRow) => {
    const data = { isActive: !item.isActive };
    if (isProducts) {
      updateProduct.mutate({ productId: item.id, data });
    } else {
      updateStore.mutate({ storeId: item.id, data });
    }
  };

  const remove = (item: ProductRow | StoreRow) => {
    const label = isProducts ? 'produk' : 'toko';
    if (!isProducts && (item as StoreRow).transactionCount > 0) {
      window.alert('Toko memiliki transaksi dan tidak bisa dihapus. Gunakan Arsipkan agar riwayat tetap aman.');
      return;
    }
    setConfirming({
      message: `Hapus ${label} "${isProducts ? (item as ProductRow).name : (item as StoreRow).name}"?`,
      onConfirm: () => {
        if (isProducts) deleteProduct.mutate({ productId: item.id });
        else deleteStore.mutate({ storeId: item.id });
      },
    });
  };

  const openNewStore = (kindToCreate: NewStoreKind) => {
    setNewStoreKind(kindToCreate);
    setNewStoreOpen(true);
  };

  const submitNewStore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createStoreFromProduct.mutate({
      data: {
        name: String(form.get('name') || '').trim(),
        channel: String(form.get('channel') || '').trim(),
        feePercent: Number(form.get('feePercent') || 0),
        isActive: true,
      },
    });
  };

  return (
    <>
      <PageTitle
        eyebrow={`POS / MASTER DATA / ${isProducts ? 'PRODUK' : 'KANAL & TOKO'}`}
        title={isProducts ? 'Produk yang siap dijual.' : 'Kanal & toko yang terhubung.'}
        description={
          isProducts
            ? 'Modal, harga, supplier, dan performa penjualan dalam satu pandangan.'
            : 'Kelola marketplace, toko, dan arsip data yang sudah memiliki transaksi.'
        }
        action={
          <Button onClick={openCreate} data-testid={`button-add-${kind}`}>
            <Plus size={16} /> Tambah {isProducts ? 'produk' : 'toko'}
          </Button>
        }
      />

      {isProducts ? (
        <div className="filter-row filter-row-wrap master-toolbar">
          <div className="tabs">
            {([
              ['all', 'Semua'],
              ['active', 'Aktif'],
              ['archived', 'Arsip'],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`tab ${productStatus === value ? 'active' : ''}`}
               onClick={() => {
                 setProductStatus(value);
                 setPage(1);
               }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sort-control">
            <span>Urutkan</span>
            <select
              value={productSort}
              onChange={(event) => {
                setProductSort(event.target.value as ProductSort);
                setPage(1);
              }}
            >
              {PRODUCT_SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {/*
           * Filter per suplier. Jumlah produk ikut ditampilkan supaya jelas
           * suplier mana yang punya banyak produk — angka itu dihitung server
           * di GET /api/suppliers (tidak perlu menghitung ulang di sini).
           */}
          <label className="sort-control">
            <span>Suplier</span>
            <select
              value={supplierFilter}
              onChange={(event) => {
                setSupplierFilter(event.target.value);
                setPage(1);
              }}
              data-testid="select-product-supplier-filter"
            >
              <option value="all">Semua suplier</option>
              <option value="none">Tanpa suplier</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({number(supplier.productCount)})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="filter-row filter-row-wrap master-toolbar">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${channelFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setChannelFilter('all');
                setPage(1);
              }}
            >
              Semua marketplace
            </button>
            {marketplaces.map((channel) => (
              <button
                type="button"
                key={channel}
                className={`tab ${channelFilter === channel ? 'active' : ''}`}
                 onClick={() => {
                   setChannelFilter(channel);
                   setPage(1);
                 }}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>
      )}

      <Panel className="table-panel">
        {loading ? (
          <State type="loading" />
        ) : error ? (
          <State
            type="error"
            onRetry={() => (isProducts ? products.refetch() : stores.refetch())}
          />
        ) : isEmpty ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {isProducts ? (
                    <>
                      <th className="bulk-col">
                        <BulkCheckbox
                          checked={bulk.allSelected(bulkPageIds)}
                          onChange={() => bulk.toggleAll(bulkPageIds)}
                          label="Pilih semua produk di halaman ini"
                        />
                      </th>
                      <th>Produk</th>
                      <th>Foto</th>
                      <th>Toko</th>
                      <th>Modal</th>
                      <th>Harga jual</th>
                      <th>Target profit</th>
                      <th>Harga min.</th>
                      <th>Status target</th>
                      <th>Penjualan</th>
                      <th>Status</th>
                      <th />
                    </>
                  ) : (
                    <>
                      <th>Toko</th>
                      <th>Kanal</th>
                      <th>Potongan</th>
                      <th>Produk / transaksi</th>
                      <th>Status</th>
                      <th />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {isProducts
                 ? visibleProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
                      <tr
                        key={item.id}
                        className={bulk.isSelected(item.id) ? 'bulk-row-selected' : undefined}
                        data-testid={`row-products-${item.id}`}
                      >
                        <td className="bulk-col">
                          <BulkCheckbox
                            checked={bulk.isSelected(item.id)}
                            onChange={() => bulk.toggle(item.id)}
                            label={`Pilih produk ${item.name}`}
                          />
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                          <small className="table-sub">
                            {item.supplierName || 'Supplier belum diisi'}
                          </small>
                        </td>
                         <td><ImagePreviewButton src={item.imageUrl} alt={`Foto ${item.name}`} /></td>
                        <td>{item.storeName}</td>
                        <td className="mono">{money(item.modal)}</td>
                        <td className="mono">{money(item.sellingPrice)}</td>
                        <td className="mono">
                          {item.targetProfitPcs ?? defaultTargetPcs === 0 ? '—' : `
                            ${item.targetProfitPcs ? money(item.targetProfitPcs) : money(defaultTargetPcs)}
                          `}
                        </td>
                        <td className="mono" data-testid={`harga-min-${item.id}`}>
                          {productTarget(item, defaultTargetPcs, safetyMarginPercent).minSellingPrice > 0 ? money(productTarget(item, defaultTargetPcs, safetyMarginPercent).minSellingPrice) : '—'}
                        </td>
                        <td className="target-cell">
                          {productTarget(item, defaultTargetPcs, safetyMarginPercent).meetsTarget ? (
                            <Badge tone="good" data-testid={`badge-target-ok-${item.id}`}>
                              ✓ Sesuai target
                            </Badge>
                          ) : (
                            <Badge tone="warn" data-testid={`badge-target-warn-${item.id}`}                              title={productTarget(item, defaultTargetPcs, safetyMarginPercent).meta}>
                              ⚠ Di bawah target
                            </Badge>
                          )}
                        </td>
                        <td className="mono">
                          <strong>{number(item.totalSold)} pcs</strong>
                          <small className="table-sub">
                            {money(item.revenue)} omzet · {money(item.profit)} profit
                          </small>
                        </td>
                        <td>
                          <Badge tone={item.isActive ? 'good' : 'neutral'}>
                            {item.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                         <td className="right">
                           <div className="button-pair table-actions">
                             <button
                               type="button"
                               className="icon-btn"
                               onClick={() => toggle(item)}
                               aria-label={item.isActive ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                               title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                               data-testid={`button-toggle-products-${item.id}`}
                             >
                               <Power size={15} />
                             </button>
                             <button
                               type="button"
                               className="icon-btn"
                               onClick={() => {
                                 openEdit(item);
                               }}
                               aria-label="Edit"
                               data-testid={`button-edit-products-${item.id}`}
                             >
                               <Pencil size={15} />
                             </button>
                             <button
                               type="button"
                               className="icon-btn danger-icon"
                               onClick={() => remove(item)}
                               aria-label="Hapus produk"
                               title="Hapus"
                               data-testid={`button-delete-products-${item.id}`}
                             >
                               <Trash2 size={15} />
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))
                    : visibleStores.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
                      <tr key={item.id} data-testid={`row-stores-${item.id}`}>
                        <td>
                          <div className="store-name-cell">
                            <ImagePreviewButton src={item.imageUrl} alt={`Logo ${item.name}`} avatar />
                            <strong>{item.name}</strong>
                          </div>
                        </td>
                        <td>{item.channel || '—'}</td>
                        <td className="mono">{item.feePercent ? `${item.feePercent}%` : '—'}</td>
                         <td className="mono">
                           {number(item.productCount)} produk · {number(item.transactionCount)} transaksi
                         </td>
                        <td>
                          <Badge tone={item.isActive ? 'good' : 'neutral'}>
                             {item.isActive ? 'Aktif' : 'Diarsipkan'}
                          </Badge>
                        </td>                         <td className="right">
                           <div className="button-pair table-actions">
                             <button
                               type="button"
                               className="icon-btn"
                               onClick={() => toggle(item)}
                               aria-label={item.isActive ? 'Nonaktifkan toko' : 'Aktifkan toko'}
                               title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                               data-testid={`button-toggle-stores-${item.id}`}
                             >
                               <Power size={15} />
                             </button>
                             <button
                               type="button"
                               className="icon-btn"
                               onClick={() => {
                                 openEdit(item);
                               }}
                               aria-label="Edit"
                               data-testid={`button-edit-stores-${item.id}`}
                             >
                               <Pencil size={15} />
                             </button>
                             <button
                               type="button"
                               className="icon-btn danger-icon"
                               onClick={() => remove(item)}
                               aria-label="Hapus toko"
                               title="Hapus"
                               data-testid={`button-delete-stores-${item.id}`}
                             >
                               <Trash2 size={15} />
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))}
               </tbody>
            </table>
          </div>
        )}
         {!loading && !error && !isEmpty && (
           <Pagination
             page={page}
             totalPages={Math.ceil((isProducts ? visibleProducts.length : visibleStores.length) / PAGE_SIZE)}
             onPageChange={setPage}
           />
         )}
      </Panel>

      {isProducts && (
        <BulkBar
          count={bulk.count}
          label="produk"
          onClear={bulk.clear}
          onDelete={bulkDeleteSelected}
          actions={[
            {
              label: 'Aktifkan',
              onClick: () => bulkSetActive(true),
              disabled: bulkUpdateProducts.isPending,
            },
            {
              label: 'Arsipkan',
              onClick: () => bulkSetActive(false),
              disabled: bulkUpdateProducts.isPending,
            },
          ]}
        />
      )}

      {open && (
        <Modal
          title={`${editing ? 'Edit' : 'Tambah'} ${isProducts ? 'produk' : 'toko'}`}
          onClose={close}
        >
          {isProducts ? (
            <ProductForm
              key={editing?.id ?? 'new'}
              editing={editingProduct}
              storeItems={storeItems}
              marketplaces={marketplaces}
              suppliers={suppliers.data ?? []}
              defaultTargetPcs={profitSettings.data?.defaultTargetProfitPcs ?? 50000}
              safetyMarginPercent={profitSettings.data?.safetyMarginPercent ?? 0}
              selectedMarketplace={selectedMarketplace}
              selectedStoreId={selectedStoreId}
              selectedSupplierId={selectedSupplierId}
              onMarketplaceChange={setSelectedMarketplace}
              onStoreChange={setSelectedStoreId}
              onSupplierChange={setSelectedSupplierId}
              onOpenNewStore={openNewStore}
              onSubmit={submit}
              onClose={close}
              pending={createProduct.isPending || updateProduct.isPending}
            />
          ) : (
            <form className="form-grid" onSubmit={submit}>
              <Field label="Nama toko">
                  <input
                    name="name"
                    defaultValue={editingStore?.name}
                    required
                    data-testid="input-store-name"
                  />
                </Field>
                <Field
                  label="Logo / foto brand"
                  hint="Tampil di daftar toko & analisa. JPG, PNG, atau WebP, otomatis diperkecil."
                >
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    data-testid="input-store-image"
                  />
                  {editingStore?.imageUrl && (
                    <ImagePreviewButton src={editingStore.imageUrl} alt={`Logo ${editingStore.name}`} />
                  )}
                </Field>
                <Field label="Kanal jualan">
                  <input
                    name="channel"
                    defaultValue={editingStore?.channel ?? ''}
                    placeholder="Marketplace, WhatsApp, web…"
                    data-testid="input-store-channel"
                  />
                </Field>
                <Field
                  label="Potongan platform (%)"
                  hint="Total komisi + biaya layanan platform dari omzet. Dipakai menghitung biaya platform otomatis saat mencatat penjualan. Isi 0 kalau mau input manual."
                >
                  <input
                    name="feePercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={editingStore?.feePercent ?? 0}
                    data-testid="input-store-fee"
                  />
                </Field>
              <div className="form-actions">
                <Button type="button" variant="ghost" onClick={close}>
                  Batal
                </Button>
                <Button type="submit" data-testid={`button-submit-${kind}`}>
                  Simpan
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {confirming && (
        <>
          <ConfirmDialog message={confirming.message} onClose={() => setConfirming(null)} onConfirm={() => {
            confirming.onConfirm();
            setConfirming(null);
          }} />
          {confirming?.action === 'view-target' && (
            <Modal title="Status target produk" onClose={() => setConfirming(null)}>
              <div className="product-target-modal">
                <p>
                  Target produk: <strong>{money(confirming.product.target)}</strong> /pcs
                  {' '}· Mode: <strong>{confirming.product.mode}</strong>
                  {' '}· Qty/batch: <strong>{confirming.product.batchQty}</strong>
                </p>
                <p>
                  Harga jual minimum yang disarankan:{' '}
                  <strong>{money(confirming.product.minSellingPrice)}</strong> /pcs
                </p>
                <p>
                  Status saat ini:{' '}
                  {confirming.product.meetsTarget ? (
                    <Badge tone="good">✓ Sesuai target</Badge>
                  ) : (
                    <Badge tone="warn">⚠ Di bawah target</Badge>
                  )}
                </p>
                {confirming.product.meta && (
                  <p>{confirming.product.meta}</p>
                )}
              </div>
              <div className="form-actions">
                <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                  Tutup
                </Button>
                {confirming.product.meetsTarget !== null && (
                  <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
                    Ok
                  </Button>
                )}
              </div>
            </Modal>
          )}
        </>
      )}

      {newStoreOpen && (
        <Modal
          title={newStoreKind === 'marketplace' ? 'Tambah marketplace & toko' : 'Tambah toko'}
          onClose={() => setNewStoreOpen(false)}
        >
          <form className="form-grid" onSubmit={submitNewStore}>
            <Field label="Nama toko / brand">
              <input name="name" required placeholder="Contoh: Sora & Soul" />
            </Field>
            <Field
              label="Marketplace / kanal"
              hint={
                newStoreKind === 'marketplace'
                  ? 'Marketplace baru dibuat bersama toko pertamanya.'
                  : undefined
              }
            >
              {newStoreKind === 'marketplace' ? (
                <input name="channel" required placeholder="Contoh: Shopee" />
              ) : (
                <select name="channel" defaultValue={selectedMarketplace} required>
                  {marketplaces.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Potongan platform (%)">
              <input name="feePercent" type="number" min="0" max="100" step="0.01" defaultValue="0" />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setNewStoreOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createStoreFromProduct.isPending}>
                {createStoreFromProduct.isPending ? 'Menyimpan…' : 'Simpan & pilih'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
