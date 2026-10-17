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
    <form className="form-grid product-form" onSubmit={onSubmit}>
      <div className="product-form-grid">
        <div className="product-form-fields">
          <Field label="Nama produk">
            <input
              name="name"
              defaultValue={editing?.name}
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
          <Field label="Toko / brand">
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
          <Field label="Modal (HPP supplier)">
            <input
              name="modal"
              type="number"
              value={hpp}
              onChange={(event) => setHpp(event.target.value)}
              min="0"
              required
              data-testid="input-product-modal"
            />
          </Field>
          <Field label="Harga jual">
            <input
              name="sellingPrice"
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              min="0"
              required
              data-testid="input-product-price"
            />
          </Field>
          <Field label="Mode kalkulator profit">
            <select
              name="profitMode"
              value={profitMode}
              onChange={(event) => setProfitMode(event.target.value as ProfitMode)}
              data-testid="select-product-profit-mode"
            >
              <option value="per_pcs">Per pcs — target Rp per pcs</option>
              <option value="volume">Volume — target Rp per blok qty</option>
            </select>
          </Field>
          <Field
            label="Target profit per pcs"
            hint={`Kosongkan untuk pakai default ${money(defaultTargetPcs)}.`}
          >
            <input
              name="targetProfitPcs"
              type="number"
              value={targetPcs}
              onChange={(event) => setTargetPcs(event.target.value)}
              min="0"
              placeholder={String(defaultTargetPcs)}
              data-testid="input-product-target-profit"
            />
          </Field>
          {profitMode === 'volume' && (
            <>
              <Field label="Target profit per batch">
                <input
                  name="targetProfitBatch"
                  type="number"
                  value={targetBatch}
                  onChange={(event) => setTargetBatch(event.target.value)}
                  min="0"
                  placeholder="Contoh: 300000"
                  data-testid="input-product-target-batch"
                />
              </Field>
              <Field label="Jumlah pcs per batch">
                <input
                  name="targetProfitBatchQty"
                  type="number"
                  value={batchQty}
                  onChange={(event) => setBatchQty(event.target.value)}
                  min="1"
                  placeholder="Contoh: 10"
                  data-testid="input-product-batch-qty"
                />
              </Field>
            </>
          )}
          <Field label="Target margin (%)">
            <input
              name="targetMargin"
              type="number"
              defaultValue={editing?.targetMargin ?? 0}
              min="0"
              data-testid="input-product-margin"
            />
          </Field>
          <Field label="Supplier">
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
          <Field
            label="Foto produk"
            hint="JPG, PNG, atau WebP. Otomatis diperkecil dan dikonversi ke WebP."
          >
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-testid="input-product-image"
            />
            {editing?.imageUrl && (
              <ImagePreviewButton src={editing.imageUrl} alt={`Foto ${editing.name}`} />
            )}
          </Field>
        </div>
        <div className="product-form-calc">{calculator}</div>
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
