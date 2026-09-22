import { describe, expect, it } from 'vitest';
import type { StorePerformanceReport, StorePerformanceRow } from '@/lib/api/types';
import {
  buildChannelInsight,
  formatGrowth,
  previousMonth,
  relativeTimeLabel,
} from '@/lib/insight';

const row = (channel: string, revenue: number, profit = revenue / 2, id = channel): StorePerformanceRow => ({
  storeId: id,
  storeName: 'Brand',
  channel,
  label: `Brand (${channel})`,
  orders: 1,
  transactions: 1,
  revenue,
  cost: revenue - profit,
  hpp: 0,
  platformFee: 0,
  profit,
  revenueShare: 0,
});

const report = (stores: StorePerformanceRow[]): StorePerformanceReport => ({
  month: null,
  totals: {
    orders: 0,
    transactions: 0,
    revenue: stores.reduce((sum, s) => sum + s.revenue, 0),
    cost: 0,
    hpp: 0,
    platformFee: 0,
    profit: stores.reduce((sum, s) => sum + s.profit, 0),
  },
  stores,
  brands: [],
});

describe('previousMonth', () => {
  it('mundur satu bulan, termasuk lintas tahun', () => {
    expect(previousMonth('2026-09')).toBe('2026-08');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('buildChannelInsight', () => {
  it('menandai kanal dengan pertumbuhan tertinggi dan menggabungkan toko sekanal', () => {
    const now = report([row('TikTok Shop', 1_245_000, 600_000, 'a'), row('TikTok Shop', 0, 0, 'b'), row('Shopee', 1_000_000)]);
    const before = report([row('TikTok Shop', 1_000_000, 300_000, 'a'), row('Shopee', 900_000)]);
    const result = buildChannelInsight(now, before);
    if (result.status !== 'ok') throw new Error('harus ok');
    expect(result.leader?.channel).toBe('TikTok Shop');
    expect(result.leader?.growth).toBeCloseTo(24.5, 5);
    expect(result.channels.map((c) => c.channel)).toEqual(['TikTok Shop', 'Shopee']);
  });

  it('kanal baru (periode lalu 0) tidak dapat persen dan tidak jadi leader', () => {
    const result = buildChannelInsight(
      report([row('Shopee', 500), row('Lazada', 9_000)]),
      report([row('Shopee', 400)]),
    );
    if (result.status !== 'ok') throw new Error('harus ok');
    const lazada = result.channels.find((c) => c.channel === 'Lazada');
    expect(lazada?.growth).toBeNull();
    expect(result.leader?.channel).toBe('Shopee');
  });

  it('semua kanal turun -> tidak ada leader, weakest terisi', () => {
    const result = buildChannelInsight(
      report([row('Shopee', 300), row('Lazada', 100)]),
      report([row('Shopee', 400), row('Lazada', 400)]),
    );
    if (result.status !== 'ok') throw new Error('harus ok');
    expect(result.leader).toBeNull();
    expect(result.weakest?.channel).toBe('Lazada');
  });

  it('kanal ke-4 dan seterusnya digabung menjadi Lainnya', () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    const result = buildChannelInsight(
      report(names.map((n, i) => row(n, 1000 - i * 100))),
      report(names.map((n) => row(n, 500))),
    );
    if (result.status !== 'ok') throw new Error('harus ok');
    expect(result.channels.map((c) => c.channel)).toEqual(['A', 'B', 'C', 'Lainnya']);
    expect(result.channels[3].revenue).toBe(700 + 600);
    expect(result.channels[3].previousRevenue).toBe(1000);
  });

  it('data tidak cukup: tidak ada angka palsu', () => {
    expect(buildChannelInsight(report([]), report([row('Shopee', 10)]))).toEqual({
      status: 'insufficient',
      reason: 'no-current',
    });
    expect(buildChannelInsight(report([row('Shopee', 10)]), report([]))).toEqual({
      status: 'insufficient',
      reason: 'no-previous',
    });
  });
});

describe('formatGrowth & relativeTimeLabel', () => {
  it('format Indonesia dengan tanda', () => {
    expect(formatGrowth(24.84)).toBe('+24,8%');
    expect(formatGrowth(-3.06)).toBe('−3,1%');
    expect(formatGrowth(0.01)).toBe('0,0%');
  });

  it('selisih waktu dihitung dari timestamp asli', () => {
    const t = 1_000_000_000_000;
    expect(relativeTimeLabel(t, t + 20_000)).toBe('baru saja');
    expect(relativeTimeLabel(t, t + 5 * 60_000)).toBe('5 menit yang lalu');
    expect(relativeTimeLabel(t, t + 3 * 3_600_000)).toBe('3 jam yang lalu');
    expect(relativeTimeLabel(t, t + 2 * 86_400_000)).toBe('2 hari yang lalu');
  });
});
