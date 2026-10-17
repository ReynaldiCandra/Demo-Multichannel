'use client';

import { useMemo } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, TrendingUp } from 'lucide-react';
import type { ProfitMode } from '@/lib/profit';
import {
  calcMinSellingPrice,
  calcMinQtyForVolumeTarget,
  calcProfitPerPcs,
} from '@/lib/profit';
import { money } from '@/lib/format';

/**
 * Kalkulator Profit Marketplace — panel hasil hitung real-time di form produk.
 *
 * Dipicu dari luar lewat props (HPP, fee%, target, mode, harga jual live):
 * komponen ini murni menampilkan hasil — begitu salah satu input berubah,
 * estimasi langsung ikut, tanpa tombol "Hitung".
 */
export function ProfitCalculator({
  hpp,
  feePercent,
  sellingPrice,
  targetProfitPcs,
  targetProfitBatch,
  batchQty,
  mode,
  safetyMarginPercent = 0,
}: {
  hpp: number;
  feePercent: number;
  sellingPrice: number;
  targetProfitPcs: number;
  targetProfitBatch: number;
  batchQty: number;
  mode: ProfitMode;
  safetyMarginPercent?: number;
}) {
  const calc = useMemo(
    () =>
      calcMinSellingPrice({ hpp, feePercent, safetyMarginPercent, targetProfitPcs }),
    [hpp, feePercent, safetyMarginPercent, targetProfitPcs],
  );

  const profitNow = calcProfitPerPcs({
    hpp,
    price: sellingPrice,
    feePercent,
    safetyMarginPercent,
  });

  const minQty = useMemo(() => {
    if (mode !== 'volume' || !targetProfitBatch) return null;
    return calcMinQtyForVolumeTarget({
      targetProfitBatch,
      batchQty,
      pricePerPcs: sellingPrice,
      hpp,
      feePercent,
      safetyMarginPercent,
    });
  }, [mode, targetProfitBatch, batchQty, sellingPrice, hpp, feePercent, safetyMarginPercent]);

  const ready = hpp > 0 && (mode === 'per_pcs' ? targetProfitPcs > 0 : targetProfitBatch > 0);
  if (!ready) {
    return (
      <div className="profit-calc profit-calc-idle" data-testid="profit-calculator">
        <div className="profit-calc-head">
          <Calculator size={15} />
          <strong>Kalkulator Profit Marketplace</strong>
        </div>
        <p className="profit-calc-empty">
          Isi HPP/modal dan target profit untuk mengaktifkan kalkulator.
        </p>
      </div>
    );
  }

  const meetsTarget = mode === 'per_pcs'
    ? sellingPrice > 0 && profitNow >= calc.effectiveTargetPcs
    : minQty !== null && minQty <= batchQty;

  // Mode volume dengan profit/pcs ≤ 0: harga terlalu rendah, saran naik harga.
  const volumePriceTooLow = mode === 'volume' && minQty === null;

  return (
    <div
      className={`profit-calc ${meetsTarget ? 'profit-ok' : 'profit-bad'}`}
      data-testid="profit-calculator"
    >
      <div className="profit-calc-head">
        <Calculator size={15} />
        <strong>Kalkulator Profit Marketplace</strong>
        <span className={`profit-calc-flag ${meetsTarget ? 'ok' : 'bad'}`}>
          {meetsTarget ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {meetsTarget ? 'Sesuai target' : 'Di bawah target'}
        </span>
      </div>

      {mode === 'per_pcs' ? (
        <>
          <div className="profit-calc-min">
            <span className="profit-calc-min-label">
              Harga jual minimum yang disarankan
            </span>
            <strong className="profit-calc-min-value" data-testid="profit-min-price">
              {money(calc.minSellingPrice)}
              <small> /pcs</small>
            </strong>
            <span className="profit-calc-min-formula">
              ({money(hpp)} HPP + {money(calc.effectiveTargetPcs)} target)
              {' '}
              {calc.safetyMarginPercent > 0 || feePercent > 0
                ? `÷ (1 − ${(feePercent + calc.safetyMarginPercent).toFixed(2).replace('.', ',')}%)`
                : ''}
            </span>
          </div>

          {sellingPrice > 0 && (
            <div
              className={`profit-calc-verdict ${profitNow >= calc.effectiveTargetPcs ? 'ok' : 'bad'}`}
              data-testid="profit-verdict"
            >
              {profitNow >= calc.effectiveTargetPcs ? (
                <>
                  <TrendingUp size={15} />
                  <span>
                    Harga {money(sellingPrice)} menghasilkan profit bersih{' '}
                    <b>{money(profitNow)}/pcs</b> — {profitNow >= calc.effectiveTargetPcs ? 'mencapai' : ''} target.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} />
                  <span>
                    Harga {money(sellingPrice)} hanya untung <b>{money(profitNow)}/pcs</b>.
                    Naikkan ke <b>{money(calc.minSellingPrice)}</b> agar profit ≥{' '}
                    {money(calc.effectiveTargetPcs)}.
                  </span>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="profit-calc-min">
            <span className="profit-calc-min-label">
              Qty minimum per transaksi agar profit ≥ {money(targetProfitBatch)}
            </span>
            {volumePriceTooLow ? (
              <strong className="profit-calc-min-value" data-testid="profit-min-qty">
                —
              </strong>
            ) : (
              <strong className="profit-calc-min-value" data-testid="profit-min-qty">
                {numberId(minQty ?? 0)}
                <small> pcs</small>
              </strong>
            )}
            <span className="profit-calc-min-formula">
              {volumePriceTooLow
                ? 'Harga jual terlalu rendah — untung/pcs ≤ 0. Naikkan harga jual dulu.'
                : `Profit ${money(profitNow)}/pcs pada harga ${money(sellingPrice)}`}
            </span>
          </div>

          {volumePriceTooLow ? (
            <div className="profit-calc-verdict bad">
              <AlertTriangle size={15} />
              <span>
                Profit per pcs masih negatif/0 pada harga {money(sellingPrice)}. Harga minimum yang
                disarankan untuk mode pcs: <b>{money(calc.minSellingPrice)}</b>.
              </span>
            </div>
          ) : (
            <div
              className={`profit-calc-verdict ${minQty !== null && batchQty >= minQty ? 'ok' : 'bad'}`}
            >
              {minQty !== null && batchQty >= minQty ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>
                    Setiap order {batchQty} pcs menghasilkan{' '}
                    <b>{money(profitNow * batchQty)}</b> — target tercapai.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} />
                  <span>
                    Order {batchQty} pcs hanya untung{' '}
                    <b>{money(profitNow * batchQty)}</b>. Butuh minimal{' '}
                    <b>{minQty} pcs</b>/order agar profit ≥ {money(targetProfitBatch)}.
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function numberId(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}
