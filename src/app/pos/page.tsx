'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  useDeleteSale,
  useListProducts,
  useListSales,
  useUpdateSale,
} from '@/lib/api/hooks';
import type { SaleRow, SaleStatus } from '@/lib/api/types';
import { Button, Panel, PageTitle, Pagination, State } from '@/components/ui';
import type { ConfirmRequest } from '@/components/ui';
import { cn, dateLabel, monthNow, number } from '@/lib/format';
import { PAGE_SIZE, STATUS_LABEL, SaleFormModal, SalesTable } from './_shared';

export default function PosPage() {
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [month, setMonth] = useState(monthNow);
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const sales = useListSales({ month });
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

  // Input Harian: capture cepat. Hanya menampilkan transaksi bulan berjalan
  // untuk pengecekan sekilas — pengelolaan & audit menyeluruh ada di menu Penjualan.
  return (
    <>
      <PageTitle
        eyebrow="INPUT HARIAN / CAPTURE"
        title="Catat penjualan hari ini."
        description="Satu transaksi, satu snapshot modal. Untuk melihat, memfilter, dan mengelola seluruh riwayat transaksi, buka menu Penjualan."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            data-testid="button-open-sale-form"
          >
            <Plus size={16} /> Catat penjualan
          </Button>
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
          </>
        )}
      </Panel>

      {formOpen && products.data && (
        <SaleFormModal
          key={editing?.id ?? 'new'}
          sale={editing}
          products={products.data}
          onClose={closeForm}
        />
      )}
    </>
  );
}
