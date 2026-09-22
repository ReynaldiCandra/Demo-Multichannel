'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Boxes,
  CircleDollarSign,
  Percent,
  Receipt,
  Search,
  ShoppingBag,
  Tag,
  Wallet,
} from 'lucide-react';
import { useSalesReport } from '@/lib/api/hooks';
import type { SalesReport, SalesReportSort } from '@/lib/api/types';
import { Badge, KpiCard, PageTitle, Panel, Pagination, Skeleton, State } from '@/components/ui';
import { cn, dateLabel, money, monthLabel, monthNow, number } from '@/lib/format';

const SORTS: Array<{ key: SalesReportSort; label: string }> = [
  { key: 'pcs', label: 'Terlaris (pcs)' },
  { key: 'revenue', label: 'Omzet' },
  { key: 'profit', label: 'Profit' },
  { key: 'margin', label: 'Margin' },
];
const PAGE_SIZE = 10;

export default function TokoPage() {
  // useSearchParams wajib di dalam Suspense agar build produksi tidak gagal.
  return (
    <Suspense fallback={<Skeleton className="kpi-skeleton" />}>
      <TokoAnalytics />
    </Suspense>
  );
}

function TokoAnalytics() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter disimpan di URL: bisa di-bookmark, dan kartu di dashboard bisa menaut langsung ke toko tertentu.
  const month = searchParams.get('month') ?? monthNow; // "all" = akumulasi
  const brand = searchParams.get('brand') ?? '';
  const storeId = searchParams.get('storeId') ?? '';
  const sort = (searchParams.get('sort') as SalesReportSort | null) ?? 'pcs';
  const isAll = month === 'all';

  const [search, setSearch] = useState('');

  const setFilters = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const query = useSalesReport({
    month: isAll ? undefined : month,
    brand: brand || undefined,
    storeId: storeId || undefined,
    sort,
  });
  const report = query.data;

  const brands = report?.filters.brands ?? [];
  const activeBrand = brands.find((item) => item.brand === brand);
  const activeChannel = activeBrand?.channels.find((item) => item.storeId === storeId);

  const title = activeChannel
    ? `${brand} · ${activeChannel.channel}`
    : brand || 'Semua toko';
  const periodLabel = isAll ? 'Akumulasi seluruh waktu' : monthLabel(month);

  return (
    <>
      <PageTitle
        eyebrow={`ANALISA TOKO / ${periodLabel.toUpperCase()}`}
        title={title}
        description="Omzet, modal, profit, dan produk yang terjual — dihitung dari transaksi yang kamu input di POS."
        action={
          <div className="button-pair">
            <input
              className="month-input"
              type="month"
              value={isAll ? '' : month}
              onChange={(event) => setFilters({ month: event.target.value || null })}
              data-testid="input-toko-month"
            />
            <button
              type="button"
              className={cn('pill', isAll && 'active')}
              onClick={() => setFilters({ month: isAll ? null : 'all' })}
              data-testid="button-toko-all-time"
            >
              Semua waktu
            </button>
          </div>
        }
      />

      <div className="pill-row" role="tablist" aria-label="Pilih toko">
        <button
          type="button"
          className={cn('pill', !brand && 'active')}
          onClick={() => setFilters({ brand: null, storeId: null })}
          data-testid="pill-brand-all"
        >
          Semua toko
        </button>
        {brands.map((item) => (
          <button
            type="button"
            key={item.brand}
            className={cn('pill', brand === item.brand && 'active')}
            onClick={() => setFilters({ brand: item.brand, storeId: null })}
            data-testid={`pill-brand-${item.brand}`}
          >
            {item.brand}
          </button>
        ))}
      </div>

      {activeBrand && activeBrand.channels.length > 1 && (
        <div className="pill-row pill-row-sub">
          <span className="pill-label">Kanal</span>
          <button
            type="button"
            className={cn('pill pill-sm', !storeId && 'active')}
            onClick={() => setFilters({ storeId: null })}
          >
            Semua kanal
          </button>
          {activeBrand.channels.map((channel) => (
            <button
              type="button"
              key={channel.storeId}
              className={cn('pill pill-sm', storeId === channel.storeId && 'active')}
              onClick={() => setFilters({ storeId: channel.storeId })}
            >
              {channel.channel}
            </button>
          ))}
        </div>
      )}

      {query.isLoading ? (
        <div className="kpi-grid">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton className="kpi-skeleton" key={index} />
          ))}
        </div>
      ) : query.isError || !report ? (
        <State type="error" onRetry={() => query.refetch()} />
      ) : (
        <div className={cn('report-body', query.isPlaceholderData && 'is-stale')}>
          <SummaryCards report={report} />
          <ExcludedNote excluded={report.excluded} />

          {report.totals.transactions === 0 ? (
            <Panel className="table-panel">
              <State type="empty" />
            </Panel>
          ) : (
            <>
              <div className="dashboard-grid">
                <Panel className="trend-panel">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">TREN HARIAN</div>
                      <h2>Omzet per hari</h2>
                    </div>
                    <Badge tone="good">{number(report.daily.length)} hari ada penjualan</Badge>
                  </div>
                  <DailyBars data={report.daily} />
                </Panel>

                <Panel className="marketplace-panel">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">PER KANAL</div>
                      <h2>Kontribusi kanal</h2>
                    </div>
                  </div>
                  <div className="marketplace-list">
                    {report.channels.map((channel, index) => (
                      <button
                        type="button"
                        className="marketplace-row marketplace-button"
                        key={channel.storeId}
                        onClick={() =>
                          setFilters({ brand: channel.storeName, storeId: channel.storeId })
                        }
                      >
                        <span className={`marketplace-avatar marketplace-avatar-${index % 4}`}>
                          {channel.storeName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="marketplace-name">
                          <strong>
                            {channel.storeName} ({channel.channel})
                          </strong>
                          <small>
                            {number(channel.pcs)} pcs · profit {money(channel.profit)}
                          </small>
                        </div>
                        <div className="marketplace-share">
                          <strong>{channel.revenueShare}%</strong>
                          <span>{money(channel.revenue)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              <ProductRanking
                report={report}
                sort={sort}
                onSort={(next) => setFilters({ sort: next === 'pcs' ? null : next })}
                search={search}
                onSearch={setSearch}
                showStore={!brand}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function SummaryCards({ report }: { report: SalesReport }) {
  const { totals } = report;
  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Omzet"
          value={money(totals.revenue)}
          meta="harga × qty − diskon"
          accent="teal"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Net profit"
          value={money(totals.profit)}
          meta={`margin ${totals.margin}%`}
          accent="yellow"
          icon={CircleDollarSign}
          trend={totals.profit >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          label="Modal / HPP"
          value={money(totals.hpp)}
          meta="modal × pcs terjual"
          accent="orange"
          icon={Wallet}
        />
        <KpiCard
          label="Pcs terjual"
          value={number(totals.pcs)}
          meta={`${number(totals.activeProducts)} produk berbeda`}
          accent="navy"
          icon={Boxes}
        />
      </div>
      <div className="kpi-grid kpi-grid-compact">
        <KpiCard
          label="Transaksi"
          value={number(totals.transactions)}
          meta="jumlah input penjualan"
          icon={Receipt}
        />
        <KpiCard
          label="Rata-rata / transaksi"
          value={money(totals.averageOrder)}
          meta="omzet ÷ transaksi"
          icon={Tag}
        />
        <KpiCard
          label="Biaya platform"
          value={money(totals.platformFee)}
          meta="sudah dikurangkan dari profit"
          icon={Percent}
        />
        <KpiCard
          label="Total diskon"
          value={money(totals.discount)}
          meta="sudah dikurangkan dari omzet"
          icon={Tag}
        />
      </div>
    </>
  );
}

function ExcludedNote({ excluded }: { excluded: SalesReport['excluded'] }) {
  const { batal, retur } = excluded;
  if (!batal.transactions && !retur.transactions) return null;
  return (
    <div className="report-note" data-testid="note-excluded">
      <span>Tidak dihitung di omzet &amp; profit:</span>
      {batal.transactions > 0 && (
        <span>
          Batal <b>{number(batal.transactions)}</b> transaksi · {number(batal.pcs)} pcs ·{' '}
          {money(batal.revenue)}
        </span>
      )}
      {retur.transactions > 0 && (
        <span>
          Retur <b>{number(retur.transactions)}</b> transaksi · {number(retur.pcs)} pcs ·{' '}
          {money(retur.revenue)}
        </span>
      )}
    </div>
  );
}

function DailyBars({ data }: { data: SalesReport['daily'] }) {
  const max = Math.max(...data.map((item) => item.revenue), 1);
  return (
    <div className="daily-bars" role="img" aria-label="Omzet per hari">
      {data.map((item) => (
        <div
          key={item.date}
          className="daily-bar"
          title={`${dateLabel(item.date)} · ${money(item.revenue)} · ${number(item.pcs)} pcs`}
        >
          <span style={{ height: `${Math.max(4, (item.revenue / max) * 100)}%` }} />
          <small>{item.date.slice(8)}</small>
        </div>
      ))}
    </div>
  );
}

function ProductRanking({
  report,
  sort,
  onSort,
  search,
  onSearch,
  showStore,
}: {
  report: SalesReport;
  sort: SalesReportSort;
  onSort: (sort: SalesReportSort) => void;
  search: string;
  onSearch: (value: string) => void;
  showStore: boolean;
}) {
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? report.products.filter((product) => product.productName.toLowerCase().includes(term))
      : report.products;
  }, [report.products, search]);

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const barKey = sort === 'pcs' ? 'pcsShare' : 'revenueShare';
  const topShare = Math.max(...filtered.map((product) => product[barKey]), 1);

  return (
    <Panel className="table-panel">
      <div className="section-head">
        <div>
          <div className="eyebrow">RINCIAN PRODUK</div>
          <h2>Produk yang terjual</h2>
          <p className="section-caption">
            {number(report.products.length)} produk · urut{' '}
            {SORTS.find((item) => item.key === sort)?.label.toLowerCase()}
          </p>
        </div>
        <label className="search-box">
          <Search size={14} />
          <input
            type="search"
            placeholder="Cari produk…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            data-testid="input-toko-search"
          />
        </label>
      </div>

      <div className="tabs tabs-sort">
        {SORTS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={cn('tab', sort === item.key && 'active')}
            onClick={() => onSort(item.key)}
            data-testid={`tab-sort-${item.key}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produk</th>
              <th className="right">Pcs</th>
              <th>{sort === 'pcs' ? 'Porsi pcs' : 'Porsi omzet'}</th>
              <th className="right">Omzet</th>
              <th className="right">Modal / HPP</th>
              <th className="right">Profit</th>
              <th className="right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product, index) => (
              <tr key={product.productId} data-testid={`row-toko-product-${product.productId}`}>
                <td className="mono muted">{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</td>
                <td>
                  <strong>{product.productName}</strong>
                  {showStore && (
                    <span className="table-sub">
                      {product.storeName} · {product.channel}
                    </span>
                  )}
                </td>
                <td className="right mono">{number(product.pcs)}</td>
                <td>
                  <div className="share-cell">
                    <div className="performance-bar">
                      <span style={{ width: `${Math.max(4, (product[barKey] / topShare) * 100)}%` }} />
                    </div>
                    <small className="mono">{product[barKey]}%</small>
                  </div>
                </td>
                <td className="right mono">{money(product.revenue)}</td>
                <td className="right mono muted">{money(product.hpp)}</td>
                <td className={cn('right mono', product.profit >= 0 ? 'profit-text' : 'negative')}>
                  {money(product.profit)}
                </td>
                <td className="right mono">{product.margin}%</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Tidak ada produk yang cocok dengan “{search}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} />
    </Panel>
  );
}
