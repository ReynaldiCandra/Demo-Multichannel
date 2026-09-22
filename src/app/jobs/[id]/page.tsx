'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BarChart3, Check, CircleDollarSign, Plus, ReceiptText } from 'lucide-react';
import {
  useCreateJobCost,
  useCreateJobPayment,
  useGetJob,
  useUpdateJob,
} from '@/lib/api/hooks';
import { Badge, Button, Field, KpiCard, Modal, Panel, PageTitle, State } from '@/components/ui';
import { dateLabel, money, today } from '@/lib/format';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const query = useGetJob(id);
  const [modal, setModal] = useState<'cost' | 'payment' | null>(null);

  const close = () => setModal(null);
  const cost = useCreateJobCost({ onSuccess: close });
  const payment = useCreateJobPayment({ onSuccess: close });
  const update = useUpdateJob();

  const detail = query.data;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (modal === 'cost') {
      cost.mutate({
        jobId: id,
        data: {
          date: String(form.get('date')),
          description: String(form.get('description')),
          amount: Number(form.get('amount')),
        },
      });
    }

    if (modal === 'payment') {
      payment.mutate({
        jobId: id,
        data: {
          date: String(form.get('date')),
          amount: Number(form.get('amount')),
          type: String(form.get('type')),
        },
      });
    }
  };

  if (query.isLoading) return <State type="loading" />;
  if (query.isError || !detail) return <State type="error" onRetry={() => query.refetch()} />;

  const markComplete = () =>
    update.mutate({
      jobId: id,
      data: {
        clientName: detail.clientName,
        jobType: detail.jobType,
        startDate: detail.startDate,
        deadline: detail.deadline,
        status: 'completed',
        contractValue: detail.contractValue,
        notes: detail.notes,
      },
    });

  return (
    <>
      <Link href="/jobs" className="back-link" data-testid="link-back-jobs">
        ← Kembali ke jobs
      </Link>

      <PageTitle
        eyebrow={`JOB / ${detail.clientName.toUpperCase()}`}
        title={detail.jobType}
        description={`Mulai ${dateLabel(detail.startDate)} · deadline ${dateLabel(detail.deadline)}`}
        action={
          <div className="button-pair">
            <Badge
              tone={
                detail.isOverdue ? 'danger' : detail.status === 'completed' ? 'good' : 'yellow'
              }
            >
              {detail.isOverdue
                ? 'Lewat deadline'
                : detail.status === 'completed'
                  ? 'Selesai'
                  : 'Berjalan'}
            </Badge>
            {detail.status !== 'completed' && (
              <Button
                variant="secondary"
                onClick={markComplete}
                disabled={update.isPending}
                data-testid="button-complete-job"
              >
                <Check size={15} /> Tandai selesai
              </Button>
            )}
          </div>
        }
      />

      <div className="detail-kpis">
        <KpiCard
          label="Nilai kontrak"
          value={money(detail.contractValue)}
          icon={CircleDollarSign}
        />
        <KpiCard label="Sudah dibayar" value={money(detail.totalPaid)} accent="teal" icon={Check} />
        <KpiCard
          label="Total biaya"
          value={money(detail.totalCost)}
          accent="orange"
          icon={ReceiptText}
        />
        <KpiCard label="Profit" value={money(detail.profit)} accent="yellow" icon={BarChart3} />
      </div>

      <div className="detail-grid">
        <Panel>
          <div className="section-head">
            <div>
              <div className="eyebrow">BIAYA</div>
              <h2>Pengeluaran job</h2>
            </div>
            <Button variant="secondary" onClick={() => setModal('cost')}>
              <Plus size={15} /> Tambah biaya
            </Button>
          </div>
          {detail.costs?.length ? (
            <div className="ledger-list">
              {detail.costs.map((item) => (
                <div className="ledger-row" key={item.id}>
                  <span>
                    <strong>{item.description}</strong>
                    <small>{dateLabel(item.date)}</small>
                  </span>
                  <b className="mono">{money(item.amount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <State type="empty" />
          )}
        </Panel>

        <Panel>
          <div className="section-head">
            <div>
              <div className="eyebrow">ARUS KAS</div>
              <h2>Pembayaran masuk</h2>
            </div>
            <Button variant="secondary" onClick={() => setModal('payment')}>
              <Plus size={15} /> Catat bayar
            </Button>
          </div>
          {detail.payments?.length ? (
            <div className="ledger-list">
              {detail.payments.map((item) => (
                <div className="ledger-row" key={item.id}>
                  <span>
                    <strong>
                      {item.type === 'down_payment'
                        ? 'Down payment'
                        : item.type === 'settlement'
                          ? 'Pelunasan'
                          : 'Lainnya'}
                    </strong>
                    <small>{dateLabel(item.date)}</small>
                  </span>
                  <b className="mono profit-text">{money(item.amount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <State type="empty" />
          )}
        </Panel>
      </div>

      {modal && (
        <Modal
          title={modal === 'cost' ? 'Tambah biaya' : 'Catat pembayaran'}
          onClose={close}
        >
          <form className="form-grid" onSubmit={submit}>
            <Field label="Tanggal">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            {modal === 'cost' ? (
              <>
                <Field label="Deskripsi">
                  <input name="description" required />
                </Field>
                <Field label="Nominal">
                  <input name="amount" type="number" min="0" required />
                </Field>
              </>
            ) : (
              <>
                <Field label="Tipe">
                  <select name="type" defaultValue="settlement">
                    <option value="down_payment">Down payment</option>
                    <option value="settlement">Pelunasan</option>
                    <option value="other">Lainnya</option>
                  </select>
                </Field>
                <Field label="Nominal">
                  <input name="amount" type="number" min="0" required />
                </Field>
              </>
            )}
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
