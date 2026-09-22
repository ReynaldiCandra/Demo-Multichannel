'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Clock, Minus, RefreshCw, TrendingUp } from 'lucide-react';
import { useStorePerformance } from '@/lib/api/hooks';
import { cn, monthLabel, monthNow } from '@/lib/format';
import {
  buildChannelInsight,
  formatGrowth,
  previousMonth,
  relativeTimeLabel,
  type ChannelGrowth,
} from '@/lib/insight';

const REFRESH_MS = 60_000;

/** Jam berdetak supaya "X menit yang lalu" ikut berjalan tanpa menunggu fetch. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Dua kartu banner di dashboard, berdampingan dengan gap yang jelas:
 *  - Kiri ("Insight periode ini"): bisa diklik, seluruh kartu jadi link ke
 *    laporan toko periode terpilih.
 *  - Kanan ("Sumber data real-time"): statis, menampilkan performa semua
 *    kanal/toko untuk periode yang sama.
 *
 * Periode terpilih memakai query yang SAMA (key yang sama) dengan KPI cards,
 * jadi angkanya tidak mungkin berbeda dari KPI. Tidak ada angka atau
 * timestamp bawaan — semuanya dari respons server.
 */
export function RealtimeInsightBanner({ month }: { month: string }) {
  const prevMonth = previousMonth(month);
  const current = useStorePerformance({ month }, { refetchInterval: REFRESH_MS });
  const previous = useStorePerformance({ month: prevMonth });
  const now = useNow();

  const prevLabel = monthLabel(prevMonth);
  const pending =
    current.isLoading ||
    previous.isLoading ||
    current.isPlaceholderData ||
    previous.isPlaceholderData;

  if (pending && !current.isError && !previous.isError) {
    return (
      <div className="rt-insight-grid" aria-busy="true" aria-label="Insight periode ini">
        <section className="rt-card rt-card-insight rt-insight-loading">
          <div className="skeleton rt-skel rt-skel-title" />
          <div className="skeleton rt-skel rt-skel-line" />
        </section>
        <section className="rt-card rt-card-source rt-insight-loading">
          <div className="skeleton rt-skel rt-skel-title" />
          <div className="skeleton rt-skel rt-skel-line" />
        </section>
      </div>
    );
  }

  if (current.isError || previous.isError || !current.data || !previous.data) {
    return (
      <div className="rt-insight-grid" aria-label="Insight periode ini">
        <section className="rt-card rt-card-insight rt-card-full">
          <div className="rt-main-copy">
            <div className="rt-lead">
              <span className="rt-icon"><TrendingUp size={13} /></span>
              <span>Insight periode ini</span>
            </div>
            <h2>Insight belum bisa dimuat</h2>
            <p>Data penjualan belum bisa diambil. Coba muat ulang beberapa detik lagi.</p>
            <button
              type="button"
              className="rt-link rt-retry"
              onClick={() => {
                current.refetch();
                previous.refetch();
              }}
              data-testid="button-insight-retry"
            >
              <RefreshCw size={12} /> Muat ulang
            </button>
          </div>
        </section>
      </div>
    );
  }

  const insight = buildChannelInsight(current.data, previous.data);
  const updatedAt = current.dataUpdatedAt;
  const runningMonth = month === monthNow;

  let headline: string;
  let body: string;
  if (insight.status === 'insufficient') {
    headline = 'Belum cukup data';
    body =
      insight.reason === 'no-current'
        ? `Belum ada penjualan selesai pada ${monthLabel(month)}. Insight muncul setelah ada transaksi.`
        : `Belum ada penjualan selesai pada ${prevLabel} sebagai pembanding, jadi pertumbuhan belum bisa dihitung.`;
  } else if (insight.leader) {
    headline = `Penjualan ${insight.leader.channel} tumbuh paling cepat.`;
    body = `Naik ${formatGrowth(insight.leader.growth ?? 0).replace('+', '')} dibanding ${prevLabel}.`;
    if (insight.leader.profit > 0) body += ' Pertimbangkan menambah budget iklan untuk produk terlaris.';
  } else if (insight.weakest && (insight.weakest.growth ?? 0) < 0) {
    headline = 'Belum ada kanal yang tumbuh.';
    body = `Omzet ${insight.weakest.channel} turun ${formatGrowth(insight.weakest.growth ?? 0).replace('−', '')} dibanding ${prevLabel}.`;
  } else {
    headline = 'Omzet stabil dibanding periode sebelumnya.';
    body = `Omzet semua kanal sama dengan ${prevLabel}.`;
  }

  const leader = insight.status === 'ok' ? insight.leader : null;

  return (
    <div className="rt-insight-grid">
      <Link
        href={`/toko?month=${month}`}
        className="rt-card rt-card-insight"
        aria-label="Insight periode ini — lihat laporan lengkap"
        data-testid="banner-realtime-insight"
      >
        <div className="rt-main">
          <div className="rt-main-copy">
            <div className="rt-lead">
              <span className="rt-icon"><TrendingUp size={13} /></span>
              <span>Insight periode ini</span>
            </div>
            <h2>{headline}</h2>
            <p>{body}</p>
            <span className="rt-link" data-testid="link-insight-report">
              Lihat laporan lengkap <ChevronRight size={12} />
            </span>
          </div>

          {leader && (
            <div className="rt-leader">
              <span className={cn('marketplace-avatar', 'marketplace-avatar-0', 'rt-leader-badge')}>
                {leader.channel.slice(0, 1).toUpperCase()}
              </span>
              <strong className="rt-leader-growth">
                {formatGrowth(leader.growth ?? 0)}
                <ArrowUpRight size={12} />
              </strong>
            </div>
          )}
        </div>
      </Link>

      <section className="rt-card rt-card-source" aria-label="Sumber data real-time">
        <div className="rt-source-head">
          <span className="rt-source-title">
            <i className="rt-dot" /> Sumber data real-time
          </span>
          <span className="rt-source-updated" data-testid="text-insight-updated">
            {updatedAt && now !== null ? (
              <>
                Data diperbarui{' '}
                <time dateTime={new Date(updatedAt).toISOString()}>
                  {relativeTimeLabel(updatedAt, now)}
                </time>
              </>
            ) : (
              'Menyinkronkan data…'
            )}
          </span>
        </div>

        {insight.status === 'ok' ? (
          <>
            <div className="rt-tiles">
              {insight.channels.map((row, index) => (
                <ChannelTile key={row.channel} row={row} index={index} />
              ))}
            </div>
            <div className="rt-foot">
              <Clock size={10} /> Pertumbuhan omzet vs {prevLabel}
              {runningMonth ? ' · bulan ini belum penuh' : ''}
            </div>
          </>
        ) : (
          <div className="rt-empty">Belum cukup data untuk membandingkan kanal.</div>
        )}
      </section>
    </div>
  );
}

function ChannelTile({ row, index }: { row: ChannelGrowth; index: number }) {
  const growth = row.growth;
  const tone = growth === null ? 'new' : growth > 0 ? 'up' : growth < 0 ? 'down' : 'flat';
  return (
    <div className="rt-tile" data-testid={`tile-insight-${row.channel.toLowerCase().replaceAll(' ', '-')}`}>
      <span className={`marketplace-avatar marketplace-avatar-${index % 4} rt-avatar`}>
        {row.channel.slice(0, 1).toUpperCase()}
      </span>
      <span className="rt-tile-copy">
        <span className="rt-tile-name" title={row.channel}>{row.channel}</span>
        <strong className={cn('rt-growth', `rt-${tone}`)}>
          {growth === null ? (
            row.revenue > 0 ? 'Baru' : '—'
          ) : (
            <>
              {formatGrowth(growth)}
              {tone === 'up' && <ArrowUpRight size={12} />}
              {tone === 'down' && <ArrowDownRight size={12} />}
              {tone === 'flat' && <Minus size={12} />}
            </>
          )}
        </strong>
      </span>
    </div>
  );
}
