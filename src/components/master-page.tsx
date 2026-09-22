'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
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
} from '@/lib/api/hooks';
import type { ProductRow, StoreRow } from '@/lib/api/types';
import { Badge, Button, Field, ImagePreviewButton, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { money, number } from '@/lib/format';

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

export function MasterPage({ kind }: { kind: 'products' | 'stores' }) {
  const isProducts = kind === 'products';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [productSort, setProductSort] = useState<ProductSort>('name');
  const [productStatus, setProductStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [newStoreOpen, setNewStoreOpen] = useState(false);
  const [newStoreKind, setNewStoreKind] = useState<NewStoreKind>('store');
  const [page, setPage] = useState(1);

  const stores = useListStores();
  const products = useListProducts();
  const suppliers = useListSuppliers({ enabled: isProducts });

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const createStore = useCreateStore({ onSuccess: close });
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

      const data = {
        storeId: selectedStoreId,
        supplierId: selectedSupplierId || null,
        name: String(form.get('name')),
        modal: Number(form.get('modal')),
        sellingPrice: Number(form.get('sellingPrice')),
        targetMargin: Number(form.get('targetMargin') || 0),
        supplierName: editingProduct?.supplierId ? null : editingProduct?.supplierName ?? null,
        supplierPhone: editingProduct?.supplierId ? null : editingProduct?.supplierPhone ?? null,
        imageUrl,
        isActive: editing ? editing.isActive : true,
      };
      if (editing) updateProduct.mutate({ productId: editing.id, data });
      else createProduct.mutate({ data });
      return;
    }

    const data = {
      name: String(form.get('name')),
      channel: String(form.get('channel') || '') || null,
      feePercent: Number(form.get('feePercent') || 0),
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
    const rows = productItems.filter((item) =>
      productStatus === 'all' ? true : productStatus === 'active' ? item.isActive : !item.isActive,
    );
    return [...rows].sort((a, b) => {
      if (productSort === 'sold') return b.totalSold - a.totalSold || a.name.localeCompare(b.name);
      if (productSort === 'profit') return b.profit - a.profit || a.name.localeCompare(b.name);
      if (productSort === 'margin') return b.margin - a.margin || a.name.localeCompare(b.name);
      if (productSort === 'unsold') {
        return (a.totalSold > 0 ? 1 : 0) - (b.totalSold > 0 ? 1 : 0) || a.name.localeCompare(b.name);
      }
      if (productSort === 'latest') {
        return (b.lastSaleDate ?? '').localeCompare(a.lastSaleDate ?? '') || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [productItems, productSort, productStatus]);
  const visibleStores = useMemo(
    () => storeItems.filter((store) => channelFilter === 'all' || store.channel === channelFilter),
    [storeItems, channelFilter],
  );
  const isEmpty = isProducts ? !visibleProducts.length : !visibleStores.length;

  const editingProduct = isProducts ? (editing as ProductRow | null) : null;
  const editingStore = isProducts ? null : (editing as StoreRow | null);

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
    if (!window.confirm(`Hapus ${label} "${isProducts ? (item as ProductRow).name : (item as StoreRow).name}"?`)) {
      return;
    }

    if (isProducts) deleteProduct.mutate({ productId: item.id });
    else deleteStore.mutate({ storeId: item.id });
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
                      <th>Produk</th>
                      <th>Foto</th>
                      <th>Toko</th>
                      <th>Modal</th>
                      <th>Harga jual</th>
                      <th>Target margin</th>
                          <th>Penjualan</th>
                      <th>Status</th>
                      <th />
                    </>
                  ) : (
                    <>
                      <th>Nama toko</th>
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
                      <tr key={item.id} data-testid={`row-products-${item.id}`}>
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
                          {item.targetMargin ? `${item.targetMargin}%` : '—'}
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
                               className="icon-btn"
                               onClick={() => toggle(item)}
                               aria-label={item.isActive ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                               title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                               data-testid={`button-toggle-products-${item.id}`}
                             >
                               <Power size={15} />
                             </button>
                          <button
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
                          <strong>{item.name}</strong>
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
                        </td>
                       <td className="right">
                         <div className="button-pair table-actions">
                           <button
                             className="icon-btn"
                             onClick={() => toggle(item)}
                             aria-label={item.isActive ? 'Nonaktifkan toko' : 'Aktifkan toko'}
                             title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                             data-testid={`button-toggle-stores-${item.id}`}
                           >
                             <Power size={15} />
                           </button>
                          <button
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

      {open && (
        <Modal
          title={`${editing ? 'Edit' : 'Tambah'} ${isProducts ? 'produk' : 'toko'}`}
          onClose={close}
        >
          <form className="form-grid" onSubmit={submit}>
            {isProducts ? (
              <>
                <Field label="Nama produk">
                  <input
                    name="name"
                    defaultValue={editingProduct?.name}
                    required
                    data-testid="input-product-name"
                  />
                </Field>
                 <Field label="Marketplace / kanal">
                   <select
                     value={selectedMarketplace}
                     onChange={(event) => {
                       const value = event.target.value;
                       if (value === '__new_marketplace__') {
                         openNewStore('marketplace');
                         return;
                       }
                       setSelectedMarketplace(value);
                       setSelectedStoreId(
                         storeItems.find((store) => store.channel === value && store.isActive)?.id ?? '',
                       );
                     }}
                     required
                     data-testid="select-product-marketplace"
                   >
                     <option value="">Pilih marketplace</option>
                     {marketplaces.map((channel) => (
                       <option key={channel} value={channel}>
                         {channel}
                       </option>
                     ))}
                     <option value="__new_marketplace__">＋ Tambah marketplace baru</option>
                   </select>
                 </Field>
                 <Field label="Toko / brand">
                   <select
                     value={selectedStoreId}
                     onChange={(event) => {
                       if (event.target.value === '__new_store__') {
                         openNewStore('store');
                         return;
                       }
                       setSelectedStoreId(event.target.value);
                     }}
                     required
                     disabled={!selectedMarketplace}
                     data-testid="select-product-store"
                   >
                     <option value="">Pilih toko</option>
                     {storeItems
                       .filter(
                         (store) =>
                           store.channel === selectedMarketplace &&
                           (store.isActive || store.id === selectedStoreId),
                       )
                       .map((store) => (
                         <option key={store.id} value={store.id}>
                           {store.name}
                         </option>
                       ))}
                     <option value="__new_store__">＋ Tambah toko baru</option>
                   </select>
                 </Field>
                <Field label="Modal">
                  <input
                    name="modal"
                    type="number"
                    defaultValue={editingProduct?.modal ?? 0}
                    min="0"
                    required
                    data-testid="input-product-modal"
                  />
                </Field>
                <Field label="Harga jual">
                  <input
                    name="sellingPrice"
                    type="number"
                    defaultValue={editingProduct?.sellingPrice ?? 0}
                    min="0"
                    required
                    data-testid="input-product-price"
                  />
                </Field>
                <Field label="Target margin (%)">
                  <input
                    name="targetMargin"
                    type="number"
                    defaultValue={editingProduct?.targetMargin ?? 0}
                    min="0"
                    data-testid="input-product-margin"
                  />
                </Field>
                <Field label="Supplier">
                  <select
                    value={selectedSupplierId}
                    onChange={(event) => setSelectedSupplierId(event.target.value)}
                    data-testid="select-product-supplier"
                  >
                    <option value="">Tanpa supplier</option>
                    {(suppliers.data ?? [])
                      .filter((supplier) => supplier.isActive || supplier.id === selectedSupplierId)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Foto produk" hint="JPG, PNG, atau WebP. Otomatis diperkecil dan dikonversi ke WebP.">
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    data-testid="input-product-image"
                  />
                  {editingProduct?.imageUrl && (
                    <ImagePreviewButton src={editingProduct.imageUrl} alt={`Foto ${editingProduct.name}`} />
                  )}
                </Field>
              </>
            ) : (
              <>
                <Field label="Nama toko">
                  <input
                    name="name"
                    defaultValue={editingStore?.name}
                    required
                    data-testid="input-store-name"
                  />
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
              </>
            )}
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit" data-testid={`button-submit-${kind}`}>
                Simpan
              </Button>
            </div>
          </form>
        </Modal>
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
