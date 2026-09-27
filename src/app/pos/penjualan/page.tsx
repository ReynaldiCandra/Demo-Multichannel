'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Boxes, CircleDollarSign, Search, ShoppingBag, Wallet } from 'lucide-react';
import {
  useDeleteSale,
  useListProducts,
  useListSales,
  useListStores,
  useUpdateSale,
} from '@/lib/api/hooks';
import type { SaleRow, SaleStatus } from '@/lib/api/types';
import { Button, KpiCard, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { cn, dateLabel, money, monthNow, monthLabel, number } from '@/lib/format';
import { PAGE_SIZE, STATUS_LABEL, SaleDetailPanel, SaleFormModal, SalesTable } from '../_shared';

export default function PenjualanPage() {
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailing, setDetailing] = useState<SaleRow | null>(null);
  const [month, setMonth] = useState(monthNow);
  const [storeId, setStoreId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const sales = useListSales({ month, storeId: storeId === 'all' ? undefined : storeId });
  const stores = useListStores();
  const products = useListProducts({ activeOnly: true });
  const update = useUpdateSale();
  const remove = useDeleteSale();

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const rows = sales.data ?? [];
  const counts = useMemo(() => {
    const result = { all: rows.length, selesai: 0, batal: 0, retur: 0 };
    for (const sale of rows) result[sale.status] += 1;
    return result;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((sale) => {
      if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
      if (!term) return true;
      return (
        sale.productName.toLowerCase().includes(term) ||
        (sale.orderNumber ?? '').toLowerCase().includes(term) ||
        sale.storeName.toLowerCase().includes(term)
      );
    });
  }, [rows, statusFilter, search]);

  // KPI ringkasan (Fase 4): dihitung dari hasil filter yang sedang tampil,
  // hanya status selesai yang dihitung sebagai omzet — senada dengan aturan
  // ledger di sisi server.
  const kpi = useMemo(() => {
    let pcs = 0;
    let revenue = 0;
    let profit = 0;
    let transactions = 0;
    for (const sale of filtered) {
      if (sale.status !== 'selesai') continue;
      transactions += 1;
      pcs += sale.qty;
      revenue += sale.grossRevenue;
      profit += sale.grossProfit;
    }
    const hpp = revenue - profit;
    return { pcs, revenue, profit, transactions, hpp };
  }, [filtered]);

  return (
    <>
      <PageTitle
        eyebrow={`PENJUALAN / KELOLA & AUDIT · ${monthLabel(month).toUpperCase()}`}
        title="Kelola seluruh transaksi."
        description="Filter, telusuri, dan koreksi transaksi yang sudah tercatat. Untuk mencatat transaksi baru dengan cepat, buka menu Input Harian."
        action={
          <Link href="/pos">
            <Button variant="secondary" data-testid="button-goto-input-harian">
              Ke Input Harian
            </Button>
          </Link>
        }
      />

      <div className="filter-row filter-row-wrap">
        <div className="tabs">
          {(['all', 'selesai', 'batal', 'retur'] as const).map((key) => (
            <button
              type="button"
              key={key}
              className={cn('tab', statusFilter === key && 'active')}
              onClick={() => {
                setStatusFilter(key);
                setPage(1);
              }}
              data-testid={`tab-sale-status-${key}`}
            >
              {key === 'all' ? 'Semua' : STATUS_LABEL[key]} · {number(counts[key])}
            </button>
          ))}
        </div>
        <div className="button-pair">
          <label className="search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder="Cari produk / no. pesanan…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              data-testid="input-sales-search"
            />
          </label>
          <select
            className="month-input"
            value={storeId}
            onChange={(event) => {
              setStoreId(event.target.value);
              setPage(1);
            }}
            aria-label="Filter toko/kanal"
            data-testid="select-sales-store"
          >
            <option value="all">Semua toko/kanal</option>
            {(stores.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.channel})
              </option>
            ))}
          </select>
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
            }}
            data-testid="input-sales-month"
          />
        </div>
      </div>

      {sales.isLoading ? (
        <State type="loading" />
      ) : sales.isError ? (
        <State type="error" onRetry={() => sales.refetch()} />
      ) : (
        <>
          <div className="kpi-grid" data-testid="sales-kpi-grid">
            <KpiCard
              label="Omzet selesai"
              value={money(kpi.revenue)}
              meta={`${number(kpi.transactions)} transaksi selesai`}
              accent="teal"
              icon={ShoppingBag}
            />
            <KpiCard
              label="Profit"
              value={money(kpi.profit)}
              meta="omzet − modal − biaya platform"
              accent="yellow"
              icon={CircleDollarSign}
              trend={kpi.profit >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              label="Modal / HPP"
              value={money(kpi.hpp)}
              meta="dari transaksi selesai"
              accent="orange"
              icon={Wallet}
            />
            <KpiCard
              label="Pcs terjual"
              value={number(kpi.pcs)}
              meta={`${number(counts.batal)} batal · ${number(counts.retur)} retur`}
              accent="navy"
              icon={Boxes}
            />
          </div>

          <Panel className="table-panel">
            <SalesTable
              sales={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
              total={filtered.length}
              onDetail={(sale) => setDetailing(sale)}
              onEdit={(sale) => {
                setEditing(sale);
                setFormOpen(true);
              }}
              onStatus={(sale, status) =>
                update.mutate({ saleId: sale.id, data: { status } })
              }
              onDelete={(sale, confirm) =>
                confirm({
                  message: `Hapus transaksi ${sale.productName} tanggal ${dateLabel(sale.date)}? Kalau pesanan dibatalkan atau diretur, lebih baik ubah statusnya saja supaya jejaknya tetap ada.`,
                  onConfirm: () => remove.mutate({ saleId: sale.id }),
                })
              }
            />
            <Pagination
              page={page}
              totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
              onPageChange={setPage}
            />
          </Panel>
        </>
      )}

      {formOpen && editing && products.data && (
        <SaleFormModal
          key={editing.id}
          sale={editing}
          products={products.data}
          onClose={closeForm}
        />
      )}

      {detailing && (
        <SaleDetailPanel
          key={detailing.id}
          sale={detailing}
          onClose={() => setDetailing(null)}
        />
      )}
    </>
  );
}
