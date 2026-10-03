'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useBulkDeleteInvoices, useDeleteInvoice, useListInvoices } from '@/lib/api/hooks';
import type { InvoiceRow } from '@/lib/api/types';
import { Badge, Button, ConfirmDialog, Panel, PageTitle, Pagination, State, type ConfirmRequest } from '@/components/ui';
import { BulkBar, BulkCheckbox, useBulkSelection } from '@/components/bulk-selection';
import { cn, dateLabel, money, number } from '@/lib/format';
import { InvoiceFormModal } from './_editor';

const PAGE_SIZE = 10;

export default function InvoicePage() {
  const invoices = useListInvoices();
  const remove = useDeleteInvoice();
  const bulkDelete = useBulkDeleteInvoices();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const rows = invoices.data ?? [];

  const bulk = useBulkSelection();
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  useEffect(() => {
    bulk.prune(rowIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIds]);
  const selectedIds = useMemo(() => [...bulk.selected], [bulk.selected]);
  const pageIds = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => row.id),
    [rows, page],
  );

  const bulkDeleteSelected = () =>
    setConfirming({
      message: `Hapus ${selectedIds.length} invoice terpilih? Item dan riwayat pembayaran ikut terhapus.`,
      onConfirm: () => {
        bulkDelete.mutate({ ids: selectedIds }, { onSuccess: () => bulk.clear() });
      },
    });
  const totals = useMemo(
    () => ({
      count: rows.length,
      outstanding: rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
      paid: rows.reduce((sum, row) => sum + row.paid, 0),
      overdue: rows.filter((row) => row.balance > 0 && row.dueDate && row.dueDate < new Date().toISOString().slice(0, 10)).length,
    }),
    [rows],
  );

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
  };

  return (
    <>
      <PageTitle
        eyebrow="INVOICE"
        title="Tagihan yang siap dikirim."
        description="Buat invoice custom (logo, scope kerja, item, DP/pembayaran), lalu export ke PDF lewat print browser."
        action={
          <Button
            onClick={() => {
              setEditingId(null);
              setEditorOpen(true);
            }}
            data-testid="button-create-invoice"
          >
            <Plus size={15} /> Buat invoice
          </Button>
        }
      />

      {invoices.isLoading ? (
        <State type="loading" />
      ) : invoices.isError ? (
        <State type="error" onRetry={() => invoices.refetch()} />
      ) : rows.length === 0 ? (
        <Panel className="table-panel">
          <State type="empty" />
        </Panel>
      ) : (
        <Panel className="table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="bulk-col">
                    <BulkCheckbox
                      checked={bulk.allSelected(pageIds)}
                      onChange={() => bulk.toggleAll(pageIds)}
                      label="Pilih semua invoice di halaman ini"
                    />
                  </th>
                  <th>Nomor</th>
                  <th>Klien</th>
                  <th>Terbit</th>
                  <th>Jatuh tempo</th>
                  <th className="right">Total</th>
                  <th className="right">Dibayar</th>
                  <th className="right">Sisa</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((invoice) => (
                  <InvoiceTableRow
                    key={invoice.id}
                    invoice={invoice}
                    selected={bulk.isSelected(invoice.id)}
                    onToggle={() => bulk.toggle(invoice.id)}
                    onEdit={() => {
                      setEditingId(invoice.id);
                      setEditorOpen(true);
                    }}
                    onDelete={() =>
                      setConfirming({
                        message: `Hapus invoice ${invoice.invoiceNumber} untuk ${invoice.clientName}? Item dan riwayat pembayaran ikut terhapus.`,
                        onConfirm: () => remove.mutate({ invoiceId: invoice.id }),
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="invoice-table-foot muted">
            {number(totals.count)} invoice · dibayar {money(totals.paid)} · sisa {money(totals.outstanding)}
            {totals.overdue > 0 ? ` · ${totals.overdue} lewat tempo` : ''}
          </div>
          <Pagination page={page} totalPages={Math.ceil(rows.length / PAGE_SIZE)} onPageChange={setPage} />
        </Panel>
      )}

      {editorOpen && (
        <InvoiceFormModal
          key={editingId ?? 'new'}
          invoiceId={editingId}
          onClose={closeEditor}
          onSaved={(savedId) => {
            closeEditor();
            window.open(`/invoice/${savedId}`, '_blank');
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          message={confirming.message}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            confirming.onConfirm();
            setConfirming(null);
          }}
        />
      )}

      <BulkBar
        count={bulk.count}
        label="invoice"
        onClear={bulk.clear}
        onDelete={bulkDeleteSelected}
      />
    </>
  );
}

function InvoiceTableRow({
  invoice,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  invoice: InvoiceRow;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const settled = invoice.balance <= 0;
  return (
    <tr className={selected ? 'bulk-row-selected' : undefined} data-testid={`row-invoice-${invoice.id}`}>
      <td className="bulk-col">
        <BulkCheckbox
          checked={selected}
          onChange={onToggle}
          label={`Pilih invoice ${invoice.invoiceNumber}`}
        />
      </td>
      <td>
        <strong>{invoice.invoiceNumber}</strong>
        <span className="table-sub">{invoice.title}</span>
      </td>
      <td>{invoice.clientName}</td>
      <td className="muted">{dateLabel(invoice.issueDate)}</td>
      <td className="muted">{invoice.dueDate ? dateLabel(invoice.dueDate) : '—'}</td>
      <td className="right mono">{money(invoice.total)}</td>
      <td className="right mono">{money(invoice.paid)}</td>
      <td className={cn('right mono', !settled && 'profit-text')}>{money(invoice.balance)}</td>
      <td>
        {settled ? <Badge tone="good">Lunas</Badge> : <Badge tone="warn">Belum lunas</Badge>}
      </td>
      <td className="right">
        <div className="button-pair table-actions">
          <a
            href={`/invoice/${invoice.id}`}
            className="icon-btn"
            aria-label="Buka & cetak invoice"
            data-testid={`button-print-invoice-${invoice.id}`}
          >
            <Printer size={15} />
          </a>
          <button
            className="icon-btn"
            onClick={onEdit}
            aria-label="Edit invoice"
            data-testid={`button-edit-invoice-${invoice.id}`}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-btn danger-icon"
            onClick={onDelete}
            aria-label="Hapus invoice"
            data-testid={`button-delete-invoice-${invoice.id}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
