'use client';

import { useMemo, useState } from 'react';
import {
  Banknote,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  FileDown,
  Filter,
  ShoppingBag,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useListLedger, useListSettlements, useUpdateSettlement } from '@/lib/api/hooks';
import type { SettlementRow } from '@/lib/api/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  KpiCard,
  Modal,
  Panel,
  PageTitle,
  Pagination,
  State,
  type ConfirmRequest,
} from '@/components/ui';
import { cn, dateLabel, money, monthLabel, monthNow, monthValue, number, today } from '@/lib/format';

const PAGE_SIZE = 10;

export default function LaporanPage() {
  // Settlement (Fase 5) tinggal satu tab di halaman yang sama; ledger tetap default.
  const [tab, setTab] = useState<'ledger' | 'settlement'>('ledger');
  const [month, setMonth] = useState(monthNow);
  const [page, setPage] = useState(1);
  const query = useListLedger();

  const rows = query.data ?? [];
  const selected = rows.find((item) => monthValue(item.month) === month) ?? rows[0];

  return (
    <>
      <PageTitle
        eyebrow="LAPORAN"
        title="Angka yang bisa dipertanggungjawabkan."
        description="Ringkas, siap dibaca ulang saat kamu mau mengambil keputusan."
        action={
          <div className="button-pair">
            <input
              className="month-input"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
              data-testid="input-ledger-month"
            />
            <Button variant="secondary" onClick={() => window.print()} data-testid="button-export-ledger">
              <FileDown size={15} /> Export
            </Button>
          </div>
        }
      />

      <div className="filter-row">
        <div className="tabs">
          <button
            type="button"
            className={cn('tab', tab === 'ledger' && 'active')}
            onClick={() => setTab('ledger')}
            data-testid="tab-ledger"
          >
            Ledger &amp; Profit
          </button>
          <button
            type="button"
            className={cn('tab', tab === 'settlement' && 'active')}
            onClick={() => setTab('settlement')}
            data-testid="tab-settlement"
          >
            Settlement
          </button>
        </div>
      </div>

      {tab === 'ledger' ? (
        <LedgerView
          query={query}
          month={month}
          selected={selected}
          page={page}
          setPage={setPage}
          rows={rows}
          onSelectMonth={(next) => {
            setMonth(next);
            setPage(1);
          }}
        />
      ) : (
        <SettlementView month={month} />
      )}
    </>
  );
}

function LedgerView({
  query,
  month,
  selected,
  page,
  setPage,
  rows,
  onSelectMonth,
}: {
  query: ReturnType<typeof useListLedger>;
  month: string;
  selected: (typeof rows)[number] | undefined;
  page: number;
  setPage: (page: number) => void;
  rows: Array<{
    month: string;
    jobIncome: number;
    jobCost: number;
    jobProfit: number;
    posRevenue: number;
    posCost: number;
    posProfit: number;
    netProfit: number;
  }>;
  onSelectMonth: (month: string) => void;
}) {
  if (query.isLoading) return <State type="loading" />;
  if (query.isError) return <State type="error" onRetry={() => query.refetch()} />;
  if (!selected) return <State type="empty" />;

  return (
    <>
      <div className="ledger-hero">
        <div>
          <span className="eyebrow">NET PROFIT</span>
          <strong>{money(selected.netProfit)}</strong>
          <span>{monthLabel(selected.month)}</span>
        </div>
        <div className="ledger-hero-side">
          <span>Pendapatan gabungan</span>
          <b>{money(Number(selected.jobIncome) + Number(selected.posRevenue))}</b>
        </div>
      </div>

      <div className="ledger-columns">
        <Panel>
          <div className="section-head">
            <div>
              <div className="eyebrow">POS</div>
              <h2>Penjualan</h2>
            </div>
            <ShoppingBag size={18} className="muted" />
          </div>
          <LedgerMetric label="Pendapatan" value={selected.posRevenue} />
          <LedgerMetric label="Modal" value={selected.posCost} negative />
          <LedgerMetric label="Profit POS" value={selected.posProfit} strong />
        </Panel>

        <Panel>
          <div className="section-head">
            <div>
              <div className="eyebrow">JOBS</div>
              <h2>Freelance</h2>
            </div>
            <BriefcaseBusiness size={18} className="muted" />
          </div>
          <LedgerMetric label="Pendapatan" value={selected.jobIncome} />
          <LedgerMetric label="Biaya" value={selected.jobCost} negative />
          <LedgerMetric label="Profit jobs" value={selected.jobProfit} strong />
        </Panel>
      </div>

      <Panel className="ledger-history">
        <div className="section-head">
          <div>
            <div className="eyebrow">RIWAYAT</div>
            <h2>Bulan sebelumnya</h2>
          </div>
          <Filter size={17} className="muted" />
        </div>
        <div className="month-list">
          {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
            <button
              className={cn('month-row', monthValue(item.month) === month && 'selected')}
              key={item.month}
              onClick={() => onSelectMonth(monthValue(item.month))}
              data-testid={`button-ledger-month-${item.month}`}
            >
              <span>{monthLabel(item.month)}</span>
              <b className="mono">{money(item.netProfit)}</b>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        <Pagination page={page} totalPages={Math.ceil(rows.length / PAGE_SIZE)} onPageChange={setPage} />
      </Panel>
    </>
  );
}

function SettlementView({ month }: { month: string }) {
  const settlements = useListSettlements(month);
  const update = useUpdateSettlement();
  const [releasing, setReleasing] = useState<SettlementRow | null>(null);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const rows = settlements.data ?? [];

  const totals = useMemo(() => {
    let pendingAmount = 0;
    let pendingStores = 0;
    let releasedAmount = 0;
    let releasedStores = 0;
    for (const row of rows) {
      if (row.status === 'released') {
        releasedStores += 1;
        releasedAmount += row.releasedAmount ?? row.expectedAmount;
      } else {
        pendingStores += 1;
        pendingAmount += row.expectedAmount;
      }
    }
    return { pendingAmount, pendingStores, releasedAmount, releasedStores };
  }, [rows]);

  const markPending = (row: SettlementRow) => {
    setConfirming({
      message: `Batalkan status cair untuk ${row.storeName} (${monthLabel(month)})? Angkanya kembali dihitung dari data dashboard.`,
      onConfirm: () => update.mutate({ storeId: row.storeId, month, data: { status: 'pending' } }),
    });
  };

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Belum dicairkan"
          value={money(totals.pendingAmount)}
          meta={`${number(totals.pendingStores)} toko menunggu`}
          accent="yellow"
          icon={Wallet}
        />
        <KpiCard
          label="Sudah dicairkan"
          value={money(totals.releasedAmount)}
          meta={`${number(totals.releasedStores)} toko cair`}
          accent="teal"
          icon={CircleDollarSign}
        />
        <KpiCard
          label="Periode"
          value={monthLabel(month)}
          meta="ganti lewat pilih bulan di atas"
          accent="navy"
          icon={Banknote}
        />
      </div>

      <Panel className="table-panel">
        {settlements.isLoading ? (
          <State type="loading" />
        ) : settlements.isError ? (
          <State type="error" onRetry={() => settlements.refetch()} />
        ) : rows.length === 0 ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Toko / Kanal</th>
                  <th className="right">Omzet selesai</th>
                  <th className="right">Biaya platform</th>
                  <th className="right">Dana (netto)</th>
                  <th>Status</th>
                  <th className="right">Nominal cair</th>
                  <th>Tanggal cair</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.storeId} data-testid={`row-settlement-${row.storeId}`}>
                    <td>
                      <strong>{row.storeName}</strong>
                      <span className="table-sub">{row.channel}</span>
                    </td>
                    <td className="right mono">{money(row.revenue)}</td>
                    <td className="right mono">{money(row.platformFee)}</td>
                    <td className="right mono profit-text">{money(row.expectedAmount)}</td>
                    <td>
                      {row.status === 'released' ? (
                        <Badge tone="good">Sudah dicairkan</Badge>
                      ) : (
                        <Badge tone="warn">Menunggu</Badge>
                      )}
                    </td>
                    <td className="right mono">
                      {row.releasedAmount !== null ? money(row.releasedAmount) : '—'}
                    </td>
                    <td className="muted">{row.releasedDate ? dateLabel(row.releasedDate) : '—'}</td>
                    <td className="right">
                      {row.status === 'released' ? (
                        <Button
                          variant="ghost"
                          onClick={() => markPending(row)}
                          disabled={update.isPending}
                          data-testid={`button-revert-settlement-${row.storeId}`}
                        >
                          <Undo2 size={14} /> Batalkan
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setReleasing(row)}
                          disabled={update.isPending}
                          data-testid={`button-mark-released-${row.storeId}`}
                        >
                          <Banknote size={14} /> Tandai cair
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {releasing && (
        <ReleaseModal
          row={releasing}
          month={month}
          onClose={() => setReleasing(null)}
          onSubmit={(data) =>
            update.mutate(
              { storeId: releasing.storeId, month, data },
              { onSuccess: () => setReleasing(null) },
            )
          }
          pending={update.isPending}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Batalkan status cair"
          confirmLabel="Batalkan status"
          message={confirming.message}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            confirming.onConfirm();
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}

function ReleaseModal({
  row,
  month,
  onClose,
  onSubmit,
  pending,
}: {
  row: SettlementRow;
  month: string;
  onClose: () => void;
  onSubmit: (data: { status: 'released'; releasedAmount: number; releasedDate: string }) => void;
  pending: boolean;
}) {
  return (
    <Modal title="Tandai dana sudah dicairkan" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSubmit({
            status: 'released',
            releasedAmount: Number(form.get('releasedAmount')),
            releasedDate: String(form.get('releasedDate') || ''),
          });
        }}
      >
        <div className="form-grid" style={{ gridColumn: '1 / -1' }}>
          <p className="muted sale-detail-muted">
            {row.storeName} ({row.channel}) · {monthLabel(month)}. Perhitungan dashboard:{' '}
            <b className="mono">{money(row.expectedAmount)}</b>. Isi nominal riil dari marketplace
            kalau berbeda (mis. ada potongan biaya lain).
          </p>
        </div>
        <Field label="Nominal benar-benar cair" hint="Wajib. Ambil dari dashboard marketplace.">
          <input
            name="releasedAmount"
            type="number"
            min="0"
            defaultValue={row.expectedAmount}
            required
            data-testid="input-release-amount"
          />
        </Field>
        <Field label="Tanggal cair" hint="Opsional — kapan dana masuk.">
          <input name="releasedDate" type="date" defaultValue={today()} data-testid="input-release-date" />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-settlement">
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LedgerMetric({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={cn('ledger-metric', strong && 'strong')}>
      <span>{label}</span>
      <b className={cn('mono', negative && 'negative')}>
        {negative ? `− ${money(value)}` : money(value)}
      </b>
    </div>
  );
}
