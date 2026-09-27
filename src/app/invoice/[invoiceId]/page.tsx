'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { useGetInvoice } from '@/lib/api/hooks';
import { Button, State } from '@/components/ui';
import { dateLabel, money, number } from '@/lib/format';

/**
 * Dokumen invoice siap cetak (Fase 6). Export PDF = tombol Cetak yang
 * memanggil window.print(); pengguna memilih "Save as PDF" di dialog
 * browser. Sidebar/topbar disembunyikan lewat @media print.
 */
export default function InvoiceDocumentPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params?.invoiceId ?? '';
  const query = useGetInvoice(invoiceId);
  const invoice = query.data;

  if (query.isLoading) return <State type="loading" />;
  if (query.isError || !invoice) return <State type="error" onRetry={() => query.refetch()} />;

  const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = total - paid;

  return (
    <>
      <div className="invoice-actions no-print">
        <Link href="/invoice" className="back-link" data-testid="link-back-invoices">
          <ArrowLeft size={14} /> Kembali ke daftar invoice
        </Link>
        <Button onClick={() => window.print()} data-testid="button-print-invoice">
          <Printer size={15} /> Cetak / Simpan PDF
        </Button>
      </div>

      <article className="invoice-doc" data-testid="invoice-document">
        <header className="invoice-head">
          <div className="invoice-brand">
            {invoice.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invoice.logoUrl} alt="Logo" className="invoice-logo" />
            )}
            <div className="invoice-issuer">
              <strong>{invoice.issuerName || 'Invoice'}</strong>
              {invoice.issuerAddress && <span>{invoice.issuerAddress}</span>}
            </div>
          </div>
          <div className="invoice-title">
            <h2>{invoice.title.toUpperCase()}</h2>
            <small>
              No. {invoice.invoiceNumber}
              <br />
              Terbit {dateLabel(invoice.issueDate)}
              {invoice.dueDate ? ` · Tempo ${dateLabel(invoice.dueDate)}` : ''}
            </small>
          </div>
        </header>

        <section className="invoice-parties">
          <div className="invoice-party">
            <span>Kepada</span>
            <strong>{invoice.clientName}</strong>
            {invoice.clientAddress && <p>{invoice.clientAddress}</p>}
          </div>
          <div className="invoice-party">
            <span>Status pembayaran</span>
            <strong>{balance <= 0 ? 'LUNAS' : `Sisa ${money(balance)}`}</strong>
            {invoice.payments.length > 0 && (
              <p>
                {invoice.payments
                  .map((payment) => `${payment.label || 'Pembayaran'}: ${money(payment.amount)}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        </section>

        {invoice.description && (
          <section className="invoice-section">
            <span className="invoice-section-title">Deskripsi</span>
            <p>{invoice.description}</p>
          </section>
        )}

        {invoice.scopeText && (
          <section className="invoice-section">
            <span className="invoice-section-title">Scope kerja</span>
            <p>{invoice.scopeText}</p>
          </section>
        )}

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="right">Qty</th>
              <th className="right">Harga</th>
              <th className="right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="right mono">{number(item.qty)}</td>
                <td className="right mono">{money(item.unitPrice)}</td>
                <td className="right mono">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="right">Subtotal</td>
              <td className="right mono">{money(total)}</td>
            </tr>
            {paid > 0 && (
              <tr>
                <td colSpan={3} className="right">Sudah dibayar</td>
                <td className="right mono">− {money(paid)}</td>
              </tr>
            )}
            <tr className="grand">
              <td colSpan={3} className="right">{balance <= 0 ? 'Total (lunas)' : 'Sisa tagihan'}</td>
              <td className="right mono">{money(Math.max(balance, 0))}</td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && <footer className="invoice-notes">{invoice.notes}</footer>}
      </article>
    </>
  );
}
