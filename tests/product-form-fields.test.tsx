import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductForm } from '@/components/product-form';

/**
 * submit() di master-page.tsx membaca field lewat FormData. Field yang tidak
 * punya `name` diam-diam tidak terkirim (mis. harga jual jadi 0), jadi test ini
 * memastikan setiap field yang dibutuhkan memang ada di markup.
 */
function render(editing: null | { id: string }) {
  return renderToStaticMarkup(
    createElement(ProductForm, {
      editing: editing as never,
      storeItems: [],
      marketplaces: [],
      suppliers: [],
      defaultTargetPcs: 50000,
      safetyMarginPercent: 0,
      selectedMarketplace: '',
      selectedStoreId: '',
      selectedSupplierId: '',
      onMarketplaceChange: () => {},
      onStoreChange: () => {},
      onSupplierChange: () => {},
      onOpenNewStore: () => {},
      onSubmit: () => {},
      onClose: () => {},
      pending: false,
    }),
  );
}

describe('ProductForm markup', () => {
  it('menyertakan field yang dibaca submit() (harga jual, mode profit, qty batch)', () => {
    const html = render(null);
    expect(html).toContain('name="sellingPrice"');
    expect(html).toContain('name="profitMode"');
    expect(html).toContain('name="targetProfitBatchQty"');
    expect(html).toContain('name="modal"');
    expect(html).toContain('name="name"');
  });

  it('tombol unggah foto tampil untuk produk baru (bukan hanya saat edit)', () => {
    const html = render(null);
    expect(html).toContain('Unggah foto');
    expect(html).toContain('type="file"');
    expect(html).toContain('name="image"');
  });

  it('tidak lagi memakai kolom kategori', () => {
    const html = render(null);
    expect(html).not.toContain('name="category"');
    expect(html).not.toContain('>Kategori<');
  });
});
