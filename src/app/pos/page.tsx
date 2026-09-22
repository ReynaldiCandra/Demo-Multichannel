'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateSale,
  useDeleteSale,
  useListProducts,
  useListSales,
  useUpdateSale,
  uploadImage,
} from '@/lib/api/hooks';
import type { ProductRow, SaleRow, SaleStatus } from '@/lib/api/types';
import { autoPlatformFee } from '@/lib/fees';
import { Badge, Button, Field, ImagePreviewButton, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { cn, dateLabel, money, monthNow, number, today } from '@/lib/format';

const STATUS_LABEL: Record<SaleStatus, string> = {
  selesai: 'Selesai',
  batal: 'Batal',
  retur: 'Retur',
};
const STATUS_TONE: Record<SaleStatus, 'good' | 'neutral' | 'danger'> = {
  selesai: 'good',
  batal: 'neutral',
  retur: 'danger',
};
const PAGE_SIZE = 10;

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

  return (
    <>
      <PageTitle
        eyebrow="POS / PENJUALAN"
        title="Catat penjualan."
        description="Satu transaksi, satu snapshot modal. Batal dan retur dicatat, tapi tidak dihitung sebagai omzet."
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

function SaleFormModal({
  sale,
  products,
  onClose,
}: {
  sale: SaleRow | null;
  products: ProductRow[];
  onClose: () => void;
}) {
  const create = useCreateSale({ onSuccess: onClose });
  const update = useUpdateSale({ onSuccess: onClose });
  const pending = create.isPending || update.isPending;

  const [productId, setProductId] = useState(sale?.productId ?? '');
  const [qty, setQty] = useState(String(sale?.qty ?? 1));
  const [price, setPrice] = useState(sale ? String(sale.actualPrice) : '');
  const [discount, setDiscount] = useState(String(sale?.discount ?? 0));

  const product = products.find((item) => item.id === productId);
  const feePercent = product?.feePercent ?? 0;
  const autoFee = autoPlatformFee(feePercent, Number(qty) || 0, Number(price) || 0, Number(discount) || 0);

  // Saat edit, biaya dianggap manual hanya kalau nilainya memang beda dari hitungan otomatis.
  const [feeManual, setFeeManual] = useState(() => {
    if (!sale) return false;
    return sale.platformFee !== autoPlatformFee(feePercent, sale.qty, sale.actualPrice, sale.discount);
  });
  const [feeInput, setFeeInput] = useState(String(sale?.platformFee ?? 0));

  const chooseProduct = (id: string) => {
    setProductId(id);
    const next = products.find((item) => item.id === id);
    // Harga jual yang tersimpan di produk langsung terisi; admin tinggal ubah kalau berbeda.
    if (next && (!sale || id !== sale.productId)) setPrice(String(next.sellingPrice || ''));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const imageFile = form.get('image');
    let imageUrl = sale?.imageUrl ?? null;
    try {
      if (imageFile instanceof File && imageFile.size > 0) {
        imageUrl = (await uploadImage(imageFile, 'sale')).url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload foto gagal.');
      return;
    }
    const data = {
      productId,
      qty: Number(qty),
      actualPrice: Number(price),
      discount: Number(discount || 0),
      platformFee: feeManual ? Number(feeInput || 0) : null,
      date: String(form.get('date')),
      status: String(form.get('status')),
      orderNumber: String(form.get('orderNumber') || '').trim() || null,
      imageUrl,
    };
    if (sale) update.mutate({ saleId: sale.id, data });
    else create.mutate({ data });
  };

  return (
    <Modal title={sale ? 'Edit penjualan' : 'Catat penjualan'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Produk">
          <select
            value={productId}
            onChange={(event) => chooseProduct(event.target.value)}
            required
            data-testid="select-sale-product"
          >
            <option value="">Pilih produk</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.storeName} ({item.channel})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nomor pesanan" hint="Opsional. Pesanan yang sama tidak bisa dicatat dua kali.">
          <input
            name="orderNumber"
            defaultValue={sale?.orderNumber ?? ''}
            placeholder="mis. 2609ABCD123"
            maxLength={64}
            data-testid="input-sale-order"
          />
        </Field>
        <Field label="Tanggal">
          <input
            name="date"
            type="date"
            defaultValue={sale?.date ?? today()}
            required
            data-testid="input-sale-date"
          />
        </Field>
        <Field label="Status pesanan">
          <select name="status" defaultValue={sale?.status ?? 'selesai'} data-testid="select-sale-status">
            <option value="selesai">Selesai</option>
            <option value="batal">Batal</option>
            <option value="retur">Retur</option>
          </select>
        </Field>
        <Field label="Jumlah">
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            required
            data-testid="input-sale-qty"
          />
        </Field>
        <Field
          label="Harga aktual (per pcs)"
          hint={product?.sellingPrice ? `Harga jual produk: ${money(product.sellingPrice)}` : undefined}
        >
          <input
            type="number"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
            data-testid="input-sale-price"
          />
        </Field>
        <Field label="Diskon">
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            data-testid="input-sale-discount"
          />
        </Field>
        <Field
          label="Biaya platform"
          hint={
            feeManual
              ? feePercent > 0
                ? `Diisi manual. Otomatis (${feePercent}%) akan menjadi ${money(autoFee)}.`
                : 'Diisi manual.'
              : feePercent > 0
                ? `Otomatis ${feePercent}% dari omzet. Ketik untuk mengganti.`
                : 'Persentase toko belum diisi — isi manual, atau atur di Produk & Stok → Toko.'
          }
        >
          <input
            type="number"
            min="0"
            value={feeManual ? feeInput : String(autoFee)}
            onChange={(event) => {
              setFeeManual(true);
              setFeeInput(event.target.value);
            }}
            data-testid="input-sale-fee"
          />
        </Field>
        <Field label="Foto transaksi" hint="Opsional: bukti pesanan atau pengiriman.">
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            data-testid="input-sale-image"
          />
          {sale?.imageUrl && <ImagePreviewButton src={sale.imageUrl} alt={`Foto transaksi ${sale.productName}`} />}
        </Field>
        {feeManual && feePercent > 0 && (
          <button
            type="button"
            className="show-more form-inline-link"
            onClick={() => setFeeManual(false)}
          >
            Kembali ke biaya otomatis
          </button>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-sale">
            {pending ? 'Menyimpan…' : sale ? 'Simpan perubahan' : 'Simpan transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SalesTable({
  sales,
  total,
  onEdit,
  onStatus,
  onDelete,
}: {
  sales: SaleRow[];
  total: number;
  onEdit: (sale: SaleRow) => void;
  onStatus: (sale: SaleRow, status: SaleStatus) => void;
  onDelete: (sale: SaleRow) => void;
}) {
  if (!total) return <State type="empty" />;

  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Foto</th>
              <th>No. pesanan</th>
              <th className="right">Qty</th>
              <th className="right">Omzet</th>
              <th className="right">Profit</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const counted = sale.status === 'selesai';
              return (
                <tr
                  key={sale.id}
                  className={cn(!counted && 'row-muted')}
                  data-testid={`row-sale-${sale.id}`}
                >
                  <td>
                    <span className="muted">{dateLabel(sale.date)}</span>
                  </td>
                  <td>
                    <strong>{sale.productName}</strong>
                    <span className="table-sub">{sale.storeName}</span>
                  </td>
                  <td><ImagePreviewButton src={sale.imageUrl} alt={`Foto transaksi ${sale.productName}`} /></td>
                  <td className="mono muted">{sale.orderNumber || '—'}</td>
                  <td className="right mono">{number(sale.qty)}</td>
                  <td className="right mono">{money(sale.grossRevenue)}</td>
                  <td className={cn('right mono', counted && 'profit-text')}>
                    {counted ? money(sale.grossProfit) : '—'}
                  </td>
                  <td>
                    <div className="status-cell">
                      <Badge tone={STATUS_TONE[sale.status]}>{STATUS_LABEL[sale.status]}</Badge>
                      <select
                        className="status-select"
                        value={sale.status}
                        onChange={(event) => onStatus(sale, event.target.value as SaleStatus)}
                        aria-label="Ubah status pesanan"
                        data-testid={`select-status-${sale.id}`}
                      >
                        <option value="selesai">Selesai</option>
                        <option value="batal">Batal</option>
                        <option value="retur">Retur</option>
                      </select>
                    </div>
                  </td>
                  <td className="right">
                    <div className="button-pair table-actions">
                      <button
                        className="icon-btn"
                        onClick={() => onEdit(sale)}
                        aria-label="Edit transaksi"
                        data-testid={`button-edit-sale-${sale.id}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => onDelete(sale)}
                        aria-label="Hapus transaksi"
                        data-testid={`button-delete-sale-${sale.id}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
