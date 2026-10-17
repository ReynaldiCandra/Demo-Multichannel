'use client';

import { useState, type FormEvent } from 'react';
import { ProfitCalculator } from '@/components/profit-calculator';
import { Button, Field, ImagePreviewButton } from '@/components/ui';
import type { ProductRow, StoreRow, Supplier } from '@/lib/api/types';
import type { ProfitMode } from '@/lib/profit';
import { money } from '@/lib/format';

/**
 * Form produk dengan kalkulator profit real-time.
 *
 * Semua field tetap uncontrolled (name=) supaya FormData di submit() induk
 * tidak berubah — komponen ini hanya menambah state kecil (mode kalkulator +
 * harga/HPP live) untuk menghidupkan panel kalkulator: begitu salah satu
 * diisi, estimasi langsung muncul tanpa tombol "Hitung".
 */
export function ProductForm({
  editing,
  storeItems,
  marketplaces,
  suppliers,
  defaultTargetPcs,
  safetyMarginPercent,
  selectedMarketplace,
  selectedStoreId,
  selectedSupplierId,
  onMarketplaceChange,
  onStoreChange,
  onSupplierChange,
  onOpenNewStore,
  onSubmit,
  onClose,
  pending,
}: {
  editing: ProductRow | null;
  storeItems: StoreRow[];
  marketplaces: string[];
  suppliers: Supplier[];
  defaultTargetPcs: number;
  safetyMarginPercent: number;
  selectedMarketplace: string;
  selectedStoreId: string;
  selectedSupplierId: string;
  onMarketplaceChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onOpenNewStore: (kind: 'marketplace' | 'store') => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [profitMode, setProfitMode] = useState<ProfitMode>(
    (editing?.profitMode as ProfitMode) ?? 'per_pcs',
  );
  const [hpp, setHpp] = useState(String(editing?.modal ?? ''));
  const [price, setPrice] = useState(String(editing?.sellingPrice ?? ''));
  const [targetPcs, setTargetPcs] = useState(String(editing?.targetProfitPcs ?? ''));
  const [targetBatch, setTargetBatch] = useState(String(editing?.targetProfitBatch ?? ''));
  const [batchQty, setBatchQty] = useState(String(editing?.targetProfitBatchQty ?? ''));

  const feePercent =
    storeItems.find((store) => store.id === selectedStoreId)?.feePercent ?? 0;

  const calculator = (
    <ProfitCalculator
      hpp={Number(hpp) || 0}
      feePercent={feePercent}
      sellingPrice={Number(price) || 0}
      targetProfitPcs={targetPcs ? Number(targetPcs) : defaultTargetPcs}
      targetProfitBatch={Number(targetBatch) || 0}
      batchQty={Number(batchQty) || 1}
      mode={profitMode}
      safetyMarginPercent={safetyMarginPercent}
    />
  );

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <div className="product-form-grid">

        {/* ============ KIRI: INFORMASI PRODUK ============ */}
        <div className="product-form-card product-form-card--info">
          <div className="product-form-card-head">Informasi Produk</div>
          <div className="product-form-product-top">
            <div className="product-form-product-image">
              {editing?.imageUrl ? (
                <ImagePreviewButton src={editing.imageUrl} alt={`Foto ${editing.name}`} />
              ) : (
                <div className="product-form-product-image-empty">
                  <span className="product-form-product-image-empty-text">Foto produk</span>
                </div>
              )}
              <div className="product-form-product-actions">
                <span className="product-form-product-photo-hint">Foto produk</span>
                <input
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="product-form-upload-input"
                  data-testid="input-product-image"
                />
                {editing?.imageUrl && (
                  <button
                    type="button"
                    className="product-form-image-change-btn"
                    onClick={() => {
                      const input = document.querySelector('.product-form-upload-input') as HTMLInputElement | null;
                      input?.click();
                    }}
                    data-testid="button-change-product-image"
                  >
                    Ubah Gambar
                  </button>
                )}
              </div>
            </div>
            <div className="product-form-product-fields">
              <Field label="Nama Produk *">
                <input
                  name="name"
                  defaultValue={editing?.name}
                  required
                  data-testid="input-product-name"
                />
              </Field>
              <Field label="Kategori">
                <select
                  name="category"
                  defaultValue=""
                  data-testid="select-product-category"
                >
                  <option value="">Pilih kategori</option>
                  <option value="perlengkapan-rumah-tangga">Perlengkapan Rumah Tangga</option>
                  <option value="elektronik">Elektronik</option>
                  <option value="buku">Buku</option>
                  <option value="olahraga">Olahraga</option>
                  <option value="kecantikan">Kecantikan</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="product-form-row-2col">
            <Field label="Supplier *">
              <select
                value={selectedSupplierId}
                onChange={(event) => onSupplierChange(event.target.value)}
                data-testid="select-product-supplier"
              >
                <option value="">Tanpa supplier</option>
                {suppliers
                  .filter((supplier) => supplier.isActive || supplier.id === selectedSupplierId)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Toko *">
              <select
                value={selectedStoreId}
                onChange={(event) => {
                  if (event.target.value === '__new_store__') {
                    onOpenNewStore('store');
                    return;
                  }
                  onStoreChange(event.target.value);
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
          </div>

          <div className="product-form-marketplace-row">
            <Field label="Marketplace / kanal">
              <select
                value={selectedMarketplace}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === '__new_marketplace__') {
                    onOpenNewStore('marketplace');
                    return;
                  }
                  onMarketplaceChange(value);
                  onStoreChange(
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
          </div>
        </div>

        {/* ============ KIRI: MODAL & TARGET PROFIT ============ */}
              <Field label="Marketplace / kanal">
              <select
                value={selectedMarketplace}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === '__new_marketplace__') {
                    onOpenNewStore('marketplace');
                    return;
                  }
                  onMarketplaceChange(value);
                  onStoreChange(
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
          </div>
        </div>

        {/* ============ KIRI: MODAL & TARGET PROFIT ============ */}
        <div className="product-form-card product-form-card--modal">
          <div className="product-form-card-head">Modal &amp; Target Profit</div>
          <div className="product-form-card-fields">
            <div className="product-form-row">
              <Field label="HPP (Modal Produk) *">
                <div className="field-money">
                  <span className="field-money-symbol">Rp</span>
                  <input
                    name="modal"
                    type="number"
                    value={hpp}
                    onChange={(event) => setHpp(event.target.value)}
                    min="0"
                    required
                    data-testid="input-product-modal"
                  />
                </div>
              </Field>
              <Field
                label="Target Profit per Pcs"
                hint="Kosongkan jika ingin menggunakan default Rp50.000"
              >
                <div className="field-money">
                  <span className="field-money-symbol">Rp</span>
                  <input
                    name="targetProfitPcs"
                    type="number"
                    value={targetPcs}
                    onChange={(event) => setTargetPcs(event.target.value)}
                    min="0"
                    placeholder={String(defaultTargetPcs)}
                    data-testid="input-product-target-profit"
                  />
                </div>
              </Field>
            </div>
            <div className="product-form-field">
              <Field
                label="Target Profit per Batch (Qty)"
                hint="Contoh: per 10 pcs (opsional)"
              >
                <div className="field-money">
                  <span className="field-money-symbol">Rp</span>
                  <input
                    name="targetProfitBatch"
                    type="number"
                    value={targetBatch}
                    onChange={(event) => setTargetBatch(event.target.value)}
                    min="0"
                    placeholder="300000"
                    data-testid="input-product-target-batch"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* ============ KANAN: KALKULATOR PROFIT MARKETPLACE ============ */}
        <div className="product-form-calc">
          {calculator}
        </div>

      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={pending} data-testid="button-submit-products">
          Simpan
        </Button>
      </div>
    </form>
  );
}
