import { describe, expect, it } from 'vitest';
import {
  JobInput,
  ModuleUpdateInput,
  SaleInput,
  StoreInput,
} from '@/lib/server/validation';
import { isModuleVisible } from '@/lib/modules';
import { autoPlatformFee } from '@/lib/fees';

describe('beta workflow: module visibility', () => {
  const modules = [
    { key: 'dashboard', isEnabled: true },
    { key: 'pos', isEnabled: false },
    { key: 'jobs', isEnabled: true },
  ];

  it('keeps unscoped settings visible and hides disabled modules', () => {
    expect(isModuleVisible(undefined, modules, true)).toBe(true);
    expect(isModuleVisible('pos', modules, true)).toBe(false);
    expect(isModuleVisible('jobs', modules, true)).toBe(true);
  });

  it('does not hide menus while modules are still loading', () => {
    expect(isModuleVisible('pos', undefined, false)).toBe(true);
    expect(isModuleVisible('pos', [], true)).toBe(true);
  });
});

describe('beta workflow: input contracts', () => {
  it('accepts a store only when brand and channel are present', () => {
    expect(StoreInput.safeParse({ name: 'Sora & Soul', channel: 'Shopee' }).success).toBe(true);
    expect(StoreInput.safeParse({ name: 'Sora & Soul' }).success).toBe(false);
  });

  it('keeps cancelled as an explicit job state', () => {
    const result = JobInput.safeParse({
      clientName: 'Nusantara Living',
      jobType: 'Meta Ads',
      startDate: '2026-09-19',
      status: 'cancelled',
      contractValue: 1000000,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('cancelled');
  });

  it('rejects invalid module toggles and invalid sales quantities', () => {
    expect(ModuleUpdateInput.safeParse({ isEnabled: true }).success).toBe(true);
    expect(ModuleUpdateInput.safeParse({ isEnabled: 'yes' }).success).toBe(false);
    expect(
      SaleInput.safeParse({
        productId: 'not-a-uuid',
        qty: 0,
        actualPrice: 1000,
        date: '2026-09-19',
      }).success,
    ).toBe(false);
  });
});
describe('penjualan: status, nomor pesanan, biaya platform otomatis', () => {
  const base = {
    productId: '11111111-1111-4111-8111-111111111111',
    qty: 2,
    actualPrice: 50000,
    date: '2026-09-19',
  };

  it('memakai status "selesai" dan biaya otomatis (null) kalau tidak diisi', () => {
    const result = SaleInput.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('selesai');
      expect(result.data.platformFee ?? null).toBeNull();
      expect(result.data.orderNumber).toBeNull();
    }
  });

  it('menerima biaya manual, nomor pesanan (dirapikan), dan status retur', () => {
    const result = SaleInput.safeParse({
      ...base,
      platformFee: 4000,
      status: 'retur',
      orderNumber: '  2609ABC  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platformFee).toBe(4000);
      expect(result.data.status).toBe('retur');
      expect(result.data.orderNumber).toBe('2609ABC');
    }
  });

  it('menolak status di luar selesai/batal/retur', () => {
    expect(SaleInput.safeParse({ ...base, status: 'pending' }).success).toBe(false);
  });

  it('menghitung biaya platform otomatis dari persentase toko', () => {
    expect(autoPlatformFee('8.00', 2, 100000, 10000)).toBe(15200);
    expect(autoPlatformFee(0, 2, 100000, 0)).toBe(0);
    expect(autoPlatformFee(6, 1, 79000, 0)).toBe(4740);
  });

  it('feePercent toko dibatasi 0–100', () => {
    expect(StoreInput.safeParse({ name: 'A', channel: 'Shopee', feePercent: 8 }).success).toBe(true);
    expect(StoreInput.safeParse({ name: 'A', channel: 'Shopee', feePercent: 120 }).success).toBe(false);
  });
});
