'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Award, Boxes, ChevronRight, CircleDollarSign, ShoppingBag, Wallet } from 'lucide-react';
import { useGetDashboardSummary, useStorePerformance } from '@/lib/api/hooks';
import type { DashboardTrendPoint, StorePerformanceReport } from '@/lib/api/types';
import { Badge, KpiCard, Panel, PageTitle, Skeleton, State } from '@/components/ui';
import { RealtimeInsightBanner } from '@/components/realtime-insight-banner';
import { dateLabel, money, monthLabel, monthNow, monthValue, number } from '@/lib/format';

/**
 * Dashboard = ringkasan penjualan toko saja: empat angka utama, tren, dan komposisi.
 * Rincian per toko/produk ada di Analisa Toko; data freelance ada di halaman Jobs.
 */
export default function DashboardPage() {
  const [month, setMonth] = useState(monthNow);
  const query = useGetDashboardSummary({ month });
  const summary = query.data;

  // Dihitung server-side dari SELURUH penjualan selesai bulan ini.
  const performance = useStorePerformance({ month });
  const channels = performance.data?.stores ?? [];
  const brands = performance.data?.brands ?? [];
  const totals = performance.data?.totals;

  return (
    <>
      <div className="dashboard-greeting">
        <div className="eyebrow">DASHBOARD MULTICHANNEL</div>
        <h1>Halo, Owner</h1>
        <p>Pantau seluruh channel, penjualan, dan profit bisnis kamu dari satu tempat.</p>
      </div>

      <RealtimeInsightBanner month={month} />

      <PageTitle
        eyebrow={`OVERVIEW / ${monthLabel(month).toUpperCase()}`}
        title="Ringkasan performa"
        description="Detail penjualan semua toko bulan ini."
        action={
          <div className="button-pair">
            <input
              className="month-input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              data-testid="input-dashboard-month"
            />
            <Link
              href={`/toko?month=${month}`}
              className="btn btn-secondary"
              data-testid="link-dashboard-analisa"
            >
              Analisa toko <ChevronRight size={14} />
            </Link>
          </div>
        }
      />

      {query.isLoading || performance.isLoading ? (
        <div className="kpi-grid">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton className="kpi-skeleton" key={index} />
          ))}
        </div>
      ) : query.isError || performance.isError || !summary ? (
        <State
          type="error"
          onRetry={() => {
            query.refetch();
            performance.refetch();
          }}
        />
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Omzet semua toko"
              value={money(totals?.revenue ?? 0)}
              meta={`${number(totals?.transactions ?? 0)} transaksi selesai`}
              accent="teal"
              icon={ShoppingBag}
            />
            <KpiCard
              label="Net profit"
              value={money(totals?.profit ?? 0)}
              meta="omzet − HPP − biaya platform"
              accent="yellow"
              icon={CircleDollarSign}
              trend={(totals?.profit ?? 0) >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              label="Modal / HPP"
              value={money(totals?.hpp ?? 0)}
              meta={`+ biaya platform ${money(totals?.platformFee ?? 0)}`}
              accent="orange"
              icon={Wallet}
            />
            <KpiCard
              label="Pcs terjual"
              value={number(totals?.orders ?? 0)}
              meta="semua toko & kanal"
              accent="navy"
              icon={Boxes}
            />
          </div>

          <div className="dashboard-grid">
            <Panel className="trend-panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">PERFORMA</div>
                  <h2>Profit enam bulan</h2>
                  <p className="section-caption">Profit penjualan toko per bulan.</p>
                </div>
                <Badge tone="good">Net profit</Badge>
              </div>
              <ProfitChart data={summary.profitTrend} />
            </Panel>

            <Panel className="marketplace-panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">KOMPOSISI KANAL</div>
                  <h2>Toko yang bergerak</h2>
                  <p className="section-caption">Kontribusi omzet bulan ini.</p>
                </div>
                <Link href="/pos/toko" className="text-link" data-testid="link-dashboard-stores">
                  kelola toko <ChevronRight size={14} />
                </Link>
              </div>
              {channels.some((store) => store.revenue > 0) ? (
                <div className="marketplace-list">
                  {channels.slice(0, 5).map((store, index) => (
                    <Link
                      className="marketplace-row marketplace-button"
                      key={store.storeId}
                      href={`/toko?month=${month}&brand=${encodeURIComponent(store.storeName)}&storeId=${store.storeId}`}
                      data-testid={`row-marketplace-${store.storeId}`}
                    >
                      <span className={`marketplace-avatar marketplace-avatar-${index % 4}`}>
                        {store.storeName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="marketplace-name">
                        <strong>{store.label}</strong>
                        <small>
                          {number(store.transactions)} transaksi · {number(store.orders)} unit
                        </small>
                      </div>
                      <div className="marketplace-share">
                        <strong>{store.revenueShare}%</strong>
                        <span>{money(store.revenue)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <State type="empty" />
              )}
            </Panel>
          </div>

          <div className="dashboard-lower-grid dashboard-lower-last">
            <Panel className="store-performance-panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">PERFORMA BRAND</div>
                  <h2>Profit per brand</h2>
                </div>
                <Link href="/pos" className="text-link" data-testid="link-dashboard-sales">
                  buka POS <ChevronRight size={14} />
                </Link>
              </div>
              {brands.some((brand) => brand.revenue > 0) ? (
                <div className="store-performance-list">
                  {brands.slice(0, 5).map((brand, index) => (
                    <Link
                      className="store-performance-row store-link"
                      key={brand.brand}
                      href={`/toko?month=${month}&brand=${encodeURIComponent(brand.brand)}`}
                      data-testid={`row-brand-performance-${index}`}
                    >
                      <div className="store-performance-title">
                        <span className="store-rank">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{brand.brand}</strong>
                          <small>
                            {number(brand.channels)} kanal · {number(brand.orders)} unit
                          </small>
                        </div>
                      </div>
                      <div className="performance-bar">
                        <span style={{ width: `${Math.max(5, brand.revenueShare)}%` }} />
                      </div>
                      <strong className="mono">{money(brand.profit)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <State type="empty" />
              )}
            </Panel>

            <Panel className="recent-panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">AKTIVITAS TERBARU</div>
                  <h2>Transaksi terakhir</h2>
                </div>
                <Link href="/pos" className="text-link" data-testid="link-dashboard-pos">
                  lihat semua <ChevronRight size={14} />
                </Link>
              </div>
              {summary.recentSales.length ? (
                <div className="activity-list">
                  {summary.recentSales.map((sale) => (
                    <div
                      className="activity-row"
                      key={sale.id}
                      data-testid={`row-recent-sale-${sale.id}`}
                    >
                      <span className="activity-icon">
                        <ShoppingBag size={15} />
                      </span>
                      <div>
                        <strong>{sale.productName}</strong>
                        <small>
                          {sale.storeName} · {dateLabel(sale.date)}
                        </small>
                      </div>
                      <div className="activity-value">
                        <strong>{money(sale.grossRevenue)}</strong>
                        <small className="profit-text">+ {money(sale.grossProfit)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <State type="empty" />
              )}
            </Panel>
          </div>

          <TopProductsCard products={performance.data?.topProducts ?? []} />
        </>
      )}
    </>
  );
}

function TopProductsCard({
  products,
}: {
  products: NonNullable<StorePerformanceReport['topProducts']>;
}) {
  return (
    <Panel className="top-products-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">PRODUK UNGGULAN</div>
          <h2>Produk Terlaris</h2>
          <p className="section-caption">Peringkat berdasarkan pcs terjual bulan ini.</p>
        </div>
        <Award size={18} className="muted" />
      </div>
      {products.length ? (
        <div className="top-product-list">
          {products.map((product, index) => (
            <div className="top-product-row" key={product.productId}>
              <span className="store-rank">{String(index + 1).padStart(2, '0')}</span>
              <div className="top-product-copy">
                <strong>{product.productName}</strong>
                <small>
                  {product.storeName} · {product.channel} · {number(product.pcs)} pcs
                </small>
              </div>
              <div className="top-product-value">
                <strong>{money(product.profit)}</strong>
                <small>margin {product.margin}%</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <State type="empty" />
      )}
    </Panel>
  );
}

function ProfitChart({ data }: { data: DashboardTrendPoint[] }) {
  if (!data.some((item) => item.posProfit !== 0)) {
    return (
      <div className="chart-wrap">
        <State type="empty" />
      </div>
    );
  }

  const values = data.map((item) => Number(item.posProfit) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // 96 = garis dasar, 23 = batas atas; nilai negatif tetap tergambar di bawah dasar.
  const y = (value: number) => 96 - ((value - min) / range) * 73;
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${y(value)}`)
    .join(' ');

  return (
    <div className="chart-wrap">
      <svg
        viewBox="0 0 100 110"
        preserveAspectRatio="none"
        className="chart-svg"
        aria-label="Grafik tren profit"
      >
        <defs>
          <linearGradient id="profit-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2dbfa8" stopOpacity=".35" />
            <stop offset="1" stopColor="#2dbfa8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${points
            .split(' ')
            .map((point) => point.replace(',', ' '))
            .join(' L ')} L 100 110 L 0 110 Z`}
          fill="url(#profit-fill)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#1f9c87"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-labels">
        {data.map((item) => (
          <span key={String(item.month)} title={money(item.posProfit)}>
            {new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(
              new Date(`${monthValue(item.month)}-01T00:00:00`),
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
