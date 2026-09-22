import type { StorePerformanceReport } from '@/lib/api/types';

/**
 * Logika murni untuk RealtimeInsightBanner.
 *
 * Semua angka dihitung dari laporan `StorePerformanceReport` yang SAMA dengan
 * yang dipakai KPI cards dashboard (endpoint /reports/stores), untuk periode
 * terpilih dan periode sebelumnya. Tidak ada angka bawaan: kalau salah satu
 * periode kosong, hasilnya `insufficient` dan UI menampilkan "Belum cukup data".
 */

export type ChannelGrowth = {
  channel: string;
  revenue: number;
  previousRevenue: number;
  profit: number;
  /** Persen perubahan omzet. `null` bila periode sebelumnya 0 (tidak bisa dibagi). */
  growth: number | null;
};

export type ChannelInsight =
  | { status: 'insufficient'; reason: 'no-current' | 'no-previous' }
  | {
      status: 'ok';
      /** Maksimal 4 baris: 3 kanal terbesar + "Lainnya" bila masih ada sisa. */
      channels: ChannelGrowth[];
      /** Kanal dengan pertumbuhan positif tertinggi (butuh omzet periode sebelumnya > 0). */
      leader: ChannelGrowth | null;
      /** Kanal dengan penurunan terdalam; hanya terisi bila tidak ada yang tumbuh. */
      weakest: ChannelGrowth | null;
    };

const VISIBLE_CHANNELS = 3;

export function previousMonth(month: string): string {
  const [year, rawMonth] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, rawMonth - 2, 1));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const growthOf = (revenue: number, previousRevenue: number): number | null =>
  previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;

function byChannel(report: StorePerformanceReport) {
  const map = new Map<string, { revenue: number; profit: number }>();
  for (const store of report.stores) {
    const key = store.channel.trim() || 'Lainnya';
    const entry = map.get(key) ?? { revenue: 0, profit: 0 };
    entry.revenue += store.revenue;
    entry.profit += store.profit;
    map.set(key, entry);
  }
  return map;
}

export function buildChannelInsight(
  current: StorePerformanceReport,
  previous: StorePerformanceReport,
): ChannelInsight {
  if (!(current.totals.revenue > 0)) return { status: 'insufficient', reason: 'no-current' };
  if (!(previous.totals.revenue > 0)) return { status: 'insufficient', reason: 'no-previous' };

  const now = byChannel(current);
  const before = byChannel(previous);
  const names = new Set([...now.keys(), ...before.keys()]);

  const rows: ChannelGrowth[] = [...names]
    .map((channel) => {
      const revenue = now.get(channel)?.revenue ?? 0;
      const previousRevenue = before.get(channel)?.revenue ?? 0;
      return {
        channel,
        revenue,
        previousRevenue,
        profit: now.get(channel)?.profit ?? 0,
        growth: growthOf(revenue, previousRevenue),
      };
    })
    .filter((row) => row.revenue > 0 || row.previousRevenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.previousRevenue - a.previousRevenue);

  const comparable = rows.filter((row) => row.growth !== null);
  const leaderCandidate = [...comparable].sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  const leader = leaderCandidate && (leaderCandidate.growth ?? 0) > 0 ? leaderCandidate : null;
  const weakestCandidate = [...comparable].sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))[0];
  const weakest = !leader && weakestCandidate ? weakestCandidate : null;

  const visible = rows.slice(0, VISIBLE_CHANNELS);
  const rest = rows.slice(VISIBLE_CHANNELS);
  const channels = [...visible];
  if (rest.length === 1) {
    // Cuma tersisa satu kanal di luar 3 besar — tampilkan nama aslinya,
    // tidak perlu digabung jadi "Lainnya" kalau tidak ada yang digabung.
    channels.push(rest[0]);
  } else if (rest.length > 1) {
    const revenue = rest.reduce((sum, row) => sum + row.revenue, 0);
    const previousRevenue = rest.reduce((sum, row) => sum + row.previousRevenue, 0);
    channels.push({
      channel: 'Lainnya',
      revenue,
      previousRevenue,
      profit: rest.reduce((sum, row) => sum + row.profit, 0),
      growth: growthOf(revenue, previousRevenue),
    });
  }

  return { status: 'ok', channels, leader, weakest };
}

/** "+24,8%" / "−3,1%" / "0,0%" — format Indonesia (koma desimal). */
export function formatGrowth(value: number): string {
  const text = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  const sign = rounded === 0 ? '' : value > 0 ? '+' : '−';
  return `${sign}${text}%`;
}

/** Selisih waktu dari `updatedAt` (ms epoch) ke `now`, dalam bahasa Indonesia. */
export function relativeTimeLabel(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 60) return 'baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  return `${Math.floor(hours / 24)} hari yang lalu`;
}
