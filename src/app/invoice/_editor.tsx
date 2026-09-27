'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateInvoice, useGetInvoice, useUpdateInvoice, uploadImage } from '@/lib/api/hooks';
import { Button, Field, Modal, State } from '@/components/ui';
import { money, today } from '@/lib/format';

type ItemDraft = { description: string; qty: string; unitPrice: string };
type PaymentDraft = { label: string; paidAt: string; amount: string };

/**
 * Form custom CRUD invoice (Fase 6): logo, identitas, scope kerja, item bebas
 * (qty boleh desimal), pembayaran (DP/cicilan/pelunasan), catatan. Tax tidak
 * ada — total langsung dari item. Tax-free by design.
 */
export function InvoiceFormModal({
  invoiceId,
  onClose,
  onSaved,
}: {
  /** null = buat baru; terisi = edit invoice ini. */
  invoiceId: string | null;
  onClose: () => void;
  onSaved?: (invoiceId: string) => void;
}) {
  const isEdit = Boolean(invoiceId);
  const detail = useGetInvoice(invoiceId ?? '');

  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('Invoice');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [issuerAddress, setIssuerAddress] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [scopeText, setScopeText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ description: '', qty: '1', unitPrice: '' }]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);

  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data;
    setNumber(d.invoiceNumber);
    setTitle(d.title);
    setClientName(d.clientName);
    setClientAddress(d.clientAddress ?? '');
    setIssuerName(d.issuerName ?? '');
    setIssuerAddress(d.issuerAddress ?? '');
    setIssueDate(d.issueDate);
    setDueDate(d.dueDate ?? '');
    setDescription(d.description ?? '');
    setScopeText(d.scopeText ?? '');
    setLogoUrl(d.logoUrl);
    setNotes(d.notes ?? '');
    setItems(
      d.items.length
        ? d.items.map((item) => ({
            description: item.description,
            qty: String(item.qty),
            unitPrice: String(item.unitPrice),
          }))
        : [{ description: '', qty: '1', unitPrice: '' }],
    );
    setPayments(
      d.payments.map((payment) => ({
        label: payment.label ?? '',
        paidAt: payment.paidAt,
        amount: String(payment.amount),
      })),
    );
  }, [detail.data]);

  const create = useCreateInvoice({ onSuccess: () => undefined });
  const update = useUpdateInvoice({ onSuccess: () => undefined });
  const pending = create.isPending || update.isPending || logoUploading;

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  const patchItem = (index: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const patchPayment = (index: number, patch: Partial<PaymentDraft>) =>
    setPayments((prev) => prev.map((payment, i) => (i === index ? { ...payment, ...patch } : payment)));

  const chooseLogo = async (file: File | null) => {
    if (!file) return;
    try {
      setLogoUploading(true);
      const uploaded = await uploadImage(file, 'invoice');
      setLogoUrl(uploaded.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload logo gagal.');
    } finally {
      setLogoUploading(false);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      invoiceNumber: number.trim(),
      title: title.trim() || 'Invoice',
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim() || null,
      issuerName: issuerName.trim() || null,
      issuerAddress: issuerAddress.trim() || null,
      issueDate,
      dueDate: dueDate || null,
      description: description.trim() || null,
      scopeText: scopeText.trim() || null,
      logoUrl,
      notes: notes.trim() || null,
      items: items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          qty: Number(item.qty) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      payments: payments
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => ({
          paidAt: payment.paidAt || today(),
          amount: Number(payment.amount) || 0,
          label: payment.label.trim() || null,
        })),
    };
    if (!data.items.length) {
      toast.error('Minimal satu item dengan deskripsi terisi.');
      return;
    }
    if (isEdit && invoiceId) {
      update.mutate(
        { invoiceId, data },
        { onSuccess: () => onSaved?.(invoiceId) },
      );
    } else {
      create.mutate({ data }, { onSuccess: (saved) => onSaved?.((saved as { id: string }).id) });
    }
  };

  if (isEdit && detail.isLoading) return <Modal title="Edit invoice" onClose={onClose}><State type="loading" /></Modal>;
  if (isEdit && (detail.isError || !detail.data)) {
    return (
      <Modal title="Edit invoice" onClose={onClose}>
        <State type="error" onRetry={() => detail.refetch()} />
      </Modal>
    );
  }

  return (
    <Modal title={isEdit ? 'Edit invoice' : 'Buat invoice'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <div className="invoice-logo-picker" style={{ gridColumn: '1 / -1' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo invoice" className="invoice-logo" />
          ) : (
            <div className="invoice-logo" aria-hidden />
          )}
          <div className="button-pair">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> {logoUploading ? 'Mengunggah…' : 'Pilih logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => chooseLogo(event.target.files?.[0] ?? null)}
                data-testid="input-invoice-logo"
              />
            </label>
            {logoUrl && (
              <Button type="button" variant="ghost" onClick={() => setLogoUrl(null)}>
                Hapus logo
              </Button>
            )}
          </div>
        </div>

        <Field label="Nomor invoice" hint="Wajib unik, mis. INV/2026/09/001.">
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            required
            maxLength={64}
            data-testid="input-invoice-number"
          />
        </Field>
        <Field label="Judul dokumen" hint="Default Invoice; boleh diganti.">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </Field>
        <Field label="Nama klien">
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
            data-testid="input-invoice-client"
          />
        </Field>
        <Field label="Tanggal invoice">
          <input
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            required
            data-testid="input-invoice-issue-date"
          />
        </Field>
        <Field label="Alamat klien" hint="Opsional, tampil di dokumen.">
          <textarea
            value={clientAddress}
            onChange={(event) => setClientAddress(event.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Jatuh tempo" hint="Opsional.">
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
        <Field label="Nama penerbit" hint="Opsional — nama/usaha Anda.">
          <input value={issuerName} onChange={(event) => setIssuerName(event.target.value)} />
        </Field>
        <Field label="Alamat penerbit">
          <textarea
            value={issuerAddress}
            onChange={(event) => setIssuerAddress(event.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Deskripsi / konteks pekerjaan" hint="Opsional — muncul di atas item.">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Scope kerja" hint="Satu poin per baris — tampil sebagai daftar di dokumen.">
          <textarea value={scopeText} onChange={(event) => setScopeText(event.target.value)} rows={3} />
        </Field>

        <div className="invoice-editor-list">
          <div className="invoice-editor-head">
            <span>Item / deskripsi</span>
            <span>Qty</span>
            <span>Harga satuan</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div className="invoice-editor-row" key={index}>
              <input
                value={item.description}
                onChange={(event) => patchItem(index, { description: event.target.value })}
                placeholder="mis. Kitchen set atas"
                data-testid={`input-invoice-item-desc-${index}`}
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={item.qty}
                onChange={(event) => patchItem(index, { qty: event.target.value })}
                aria-label="Qty"
              />
              <input
                type="number"
                min="0"
                value={item.unitPrice}
                onChange={(event) => patchItem(index, { unitPrice: event.target.value })}
                placeholder="0"
                aria-label="Harga satuan"
              />
              <button
                type="button"
                className="icon-btn danger-icon"
                onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                aria-label="Hapus item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="invoice-editor-row">
            <span className="mono" style={{ gridColumn: '1 / 4', textAlign: 'right' }}>
              Subtotal: <b>{money(subtotal)}</b>
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setItems((prev) => [...prev, { description: '', qty: '1', unitPrice: '' }])}
              data-testid="button-add-invoice-item"
            >
              <Plus size={14} /> Item
            </Button>
          </div>
        </div>

        <div className="invoice-editor-list">
          <div className="invoice-editor-head">
            <span>Pembayaran (DP / cicilan)</span>
            <span>Tanggal</span>
            <span>Nominal</span>
            <span />
          </div>
          {payments.map((payment, index) => (
            <div className="invoice-editor-row" key={index}>
              <input
                value={payment.label}
                onChange={(event) => patchPayment(index, { label: event.target.value })}
                placeholder="mis. DP 50%"
              />
              <input
                type="date"
                value={payment.paidAt}
                onChange={(event) => patchPayment(index, { paidAt: event.target.value })}
                aria-label="Tanggal bayar"
              />
              <input
                type="number"
                min="0"
                value={payment.amount}
                onChange={(event) => patchPayment(index, { amount: event.target.value })}
                placeholder="0"
                aria-label="Nominal bayar"
              />
              <button
                type="button"
                className="icon-btn danger-icon"
                onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Hapus pembayaran"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="invoice-editor-row">
            <span className="mono" style={{ gridColumn: '1 / 4', textAlign: 'right' }}>
              Sisa tagihan: <b>{money(subtotal - paid)}</b>
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setPayments((prev) => [...prev, { label: '', paidAt: today(), amount: '' }])
              }
              data-testid="button-add-invoice-payment"
            >
              <Plus size={14} /> Bayar
            </Button>
          </div>
        </div>

        <Field label="Catatan / rekening" hint="Opsional — tampil di bagian bawah dokumen.">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-invoice">
            {pending ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Buat invoice'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
