'use client';

import { useState } from 'react';
import { BriefcaseBusiness, ChevronRight, FileDown, Filter, ShoppingBag } from 'lucide-react';
import { useListLedger } from '@/lib/api/hooks';
import { Button, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { cn, money, monthLabel, monthNow, monthValue } from '@/lib/format';

const PAGE_SIZE = 10;

export default function LaporanPage() {
  const query = useListLedger();
  const [month, setMonth] = useState(monthNow);
  const [page, setPage] = useState(1);

  const rows = query.data ?? [];
  const selected = rows.find((item) => monthValue(item.month) === month) ?? rows[0];

  return (
    <>
      <PageTitle
        eyebrow="LAPORAN / LEDGER"
        title="Angka yang bisa dipertanggungjawabkan."
        description="Ringkas, siap dibaca ulang saat kamu mau mengambil keputusan."
        action={
          <div className="button-pair">
            <input
              className="month-input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              data-testid="input-ledger-month"
            />
            <Button
              variant="secondary"
              onClick={() => window.print()}
              data-testid="button-export-ledger"
            >
              <FileDown size={15} /> Export
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <State type="loading" />
      ) : query.isError ? (
        <State type="error" onRetry={() => query.refetch()} />
      ) : selected ? (
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
                  className={cn('month-row', item.month === selected.month && 'selected')}
                  key={item.month}
                  onClick={() => setMonth(monthValue(item.month))}
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
      ) : (
        <State type="empty" />
      )}
    </>
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
