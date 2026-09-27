'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  useDeleteSale,
  useListProducts,
  useListSales,
  useListStores,
  useUpdateSale,
} from '@/lib/api/hooks';
import type { SaleRow, SaleStatus } from '@/lib/api/types';
import { Button, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { cn, dateLabel, monthNow, number } from '@/lib/format';
import { PAGE_SIZE, STATUS_LABEL, SaleFormModal, SalesTable } from '../_shared';

export default function PenjualanPage() {
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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

  return (
    <>
      <PageTitle
        eyebrow="PENJUALAN / KELOLA & AUDIT"
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

      <Panel className="table-panel">
        {sales.isLoading ? (
          <State type="loading" />
        ) : sales.isError ? (
          <State type="error" onRetry={() => sales.refetch()} />
        ) : (
          <>
            <SalesTable
              sales={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
              total={filtered.length}
              onEdit={(sale) => {
                setEditing(sale);
                setFormOpen(true);
              }}
              onStatus={(sale, status) =>
                update.mutate({ saleId: sale.id, data: { status } })
              }
              onDelete={(sale) => {
                if (
                  window.confirm(
                    `Hapus transaksi ${sale.productName} tanggal ${dateLabel(sale.date)}? Kalau pesanan dibatalkan atau diretur, lebih baik ubah statusnya saja supaya jejaknya tetap ada.`,
                  )
                ) {
                  remove.mutate({ saleId: sale.id });
                }
              }}
            />
            <Pagination
              page={page}
              totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
              onPageChange={setPage}
            />
          </>
        )}
      </Panel>

      {formOpen && editing && products.data && (
        <SaleFormModal
          key={editing.id}
          sale={editing}
          products={products.data}
          onClose={closeForm}
        />
      )}
    </>
  );
}
