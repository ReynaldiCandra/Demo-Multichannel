'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, TrendingUp, Radio } from 'lucide-react';
import type { ProfitMode } from '@/lib/profit';
import {
  calcMinSellingPrice,
  calcMinQtyForVolumeTarget,
  calcProfitPerPcs,
} from '@/lib/profit';
import { money } from '@/lib/format';

/**
 * Kalkulator Profit Marketplace — panel kiri-kanan seperti contoh.
 *
 * Tampilkan:
 * - Mode toggle (Per Pcs / Volume)
 * - Input Harga Jual (Live) & Fee Marketplace (%)
 * - Tombol Hitung (ubah harga/manual — estimasi live tetap jalan)
 * - Rekomendasi harga minimum (hijau)
 * - Detail Perhitungan
 * - Card warning (merah, diluar kalkulator utama)
 * - Contoh harga salah (merah)
 * - Contoh harga benar (hijau)
 */
export function ProfitCalculator({
  hpp,
  feePercent,
  mode,
  safetyMarginPercent = 0,
}: {
  hpp: number;
  feePercent: number;
  mode: ProfitMode;
  safetyMarginPercent?: number;
}) {
  const [sellingPrice, setSellingPrice] = useState('');
  const [feeInput, setFeeInput] = useState(String(feePercent));

  const hppNum = hpp;
  const feeNum = Number(feeInput) || 0;
  const priceNum = Number(sellingPrice) || 0;

  const minPrice = useMemo(() => {
    if (mode === 'volume') return 0;
    return calcMinSellingPrice({
      hpp: hppNum,
      feePercent: feeNum,
      safetyMarginPercent,
      targetProfitPcs: 50000,
    }).minSellingPrice;
  }, [mode, hppNum, feeNum, safetyMarginPercent]);

  const targetPcs = 50000;
  const targetBatch = 300000;
  const batchQty = 10;

  const profitPerPcs = useMemo(() => {
    if (!priceNum) return 0;
    return calcProfitPerPcs({
      hpp: hppNum,
      price: priceNum,
      feePercent: feeNum,
      safetyMarginPercent,
    });
  }, [hppNum, priceNum, feeNum, safetyMarginPercent]);

  const minQty = useMemo(() => {
    if (mode !== 'volume' || !targetBatch) return null;
    return calcMinQtyForVolumeTarget({
      targetProfitBatch: targetBatch,
      batchQty,
      pricePerPcs: priceNum,
      hpp: hppNum,
      feePercent: feeNum,
      safetyMarginPercent,
    });
  }, [mode, priceNum, hppNum, feeNum, safetyMarginPercent]);

  const perPcsOk = priceNum > 0 && profitPerPcs >= targetPcs;
  const volumeOk = minQty !== null && priceNum > 0 && batchQty >= minQty;
  const ok = mode === 'per_pcs' ? perPcsOk : volumeOk;

  const feeTitle =
    mode === 'per_pcs'
      ? (feeNum > 0 ? `${feeNum}% dari omzet` : 'Tidak ada fee')
      : (feeNum > 0 ? `${feeNum}% dari omzet` : 'Tidak ada fee');

  // Contoh kasus: harga Rp100.000 vs Rp120.000
  const examplePriceLow = 100000;
  const examplePriceMin = minPrice;
  const profitLow = calcProfitPerPcs({
    hpp: hppNum,
    price: examplePriceLow,
    feePercent: feeNum,
    safetyMarginPercent,
  });
  const profitMin = calcProfitPerPcs({
    hpp: hppNum,
    price: examplePriceMin,
    feePercent: feeNum,
    safetyMarginPercent,
  });

  const exampleFeeAmount = Math.round(examplePriceMin * (feeNum / 100));

  return (
    <div className="profit-calc-marketplace" data-testid="profit-calculator">
      <div className="profit-calc-head">
        <Calculator size={15} />
        <strong>Kalkulator Profit Marketplace</strong>
      </div>

      {/* Mode toggle */}
      <div className="profit-calc-tabs">
        <button
          type="button"
          className={`profit-calc-tab ${mode === 'per_pcs' ? 'active' : ''}`}
          onClick={() => {}}
        >
          <Radio size={12} /> Mode Per Pcs
        </button>
        <button
          type="button"
          className={`profit-calc-tab ${mode === 'volume' ? 'active' : ''}`}
          onClick={() => {}}
        >
          Mode Volume (Qty)
        </button>
      </div>

      {/* Input Harga Jual (Live) & Fee Marketplace + tombol Hitung */}
      <div className="profit-calc-inputs">
        <div className="profit-calc-input">
          <label className="profit-calc-input-label">Harga Jual (Live)</label>
          <div className="field-money">
            <span className="field-money-symbol">Rp</span>
            <input
              type="number"
              className="profit-calc-input-field"
              placeholder="0"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              data-testid="input-harga-jual-live"
            />
          </div>
          <small className="profit-calc-input-hint">Untuk perhitungan mode volume</small>
        </div>

        <div className="profit-calc-input">
          <label className="profit-calc-input-label">Fee Marketplace (%)</label>
          <div className="field-money">
            <input
              type="number"
              className="profit-calc-input-field profit-calc-input-field--no-symbol"
              placeholder="0"
              value={feeInput}
              onChange={(event) => setFeeInput(event.target.value)}
              data-testid="input-fee-marketplace"
            />
            <span className="field-money-symbol">%</span>
          </div>
          <small className="profit-calc-input-hint">Otomatis dari kanal &amp; toko</small>
        </div>

        <button
          type="button"
          className="profit-calc-hitung-btn"
          data-testid="button-hitung"
        >
          Hitung
        </button>
      </div>

      {/* Rekomendasi harga minimum (hijau) */}
      {ok && priceNum > 0 ? (
        <div className="profit-calc-green" data-testid="profit-calc-green">
          <div className="profit-calc-green-head">
            <CheckCircle2 size={14} />
            <strong>Harga jual minimum yang disarankan</strong>
          </div>
          <div className="profit-calc-green-value">
            {money(minPrice)}
            <small>/ pcs</small>
          </div>
          <div className="profit-calc-green-sub">
            ({money(hppNum)} HPP + {money(targetPcs)} Target)
            {' '}
            {feeNum > 0 || safetyMarginPercent > 0
              ? `÷ (1 − ${(feeNum + safetyMarginPercent).toFixed(2).replace('.', ',')}%)`
              : ''}
          </div>
        </div>
      ) : (
        <div className="profit-calc-green profit-calc-green--empty">
          <small>Isi harga jual untuk melihat rekomendasi</small>
        </div>
      )}

      {/* Detail Perhitungan */}
      {ok && priceNum > 0 && minPrice > 0 && (
        <div className="profit-calc-detail" data-testid="profit-calc-detail">
          <div className="profit-calc-detail-head">Detail Perhitungan</div>
          <div className="profit-calc-detail-row">
            <span>HPP (Modal Produk)</span>
            <b className="mono">{money(hppNum)}</b>
          </div>
          <div className="profit-calc-detail-row">
            <span>Target Profit per Pcs</span>
            <b className="mono">{money(targetPcs)}</b>
          </div>
          <div className="profit-calc-detail-row">
            <span>Fee Marketplace ({feeNum}%)</span>
            <b className="mono">{money(exampleFeeAmount)}</b>
          </div>
          <div className="profit-calc-detail-row profit-calc-detail-row--total">
            <span>Total Harga Jual Minimum</span>
            <b className="mono">{money(minPrice)}</b>
          </div>
        </div>
      )}

      {/* Contoh harga salah (merah) */}
      {hppNum > 0 && feeNum > 0 && (
        <div className="profit-calc-example profit-calc-example--bad">
          <div className="profit-calc-example-head">
            <AlertTriangle size={14} />
            <strong>Contoh Jika Harga Jual Tidak Sesuai</strong>
          </div>
          <div className="profit-calc-example-body">
            <div className="profit-calc-example-label">Harga Jual Anda</div>
            <b className="profit-calc-example-value">{money(examplePriceLow)}</b>
            <div className="profit-calc-example-status profit-calc-example-status--bad">
              <AlertTriangle size={12} />
              Profit tidak cukup
            </div>
            <div className="profit-calc-example-selisih">
              Selisih
              <b className="mono">
                -{money(targetPcs - profitLow)}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* Contoh harga benar (hijau) */}
      {minPrice > 0 && (
        <div className="profit-calc-example profit-calc-example--good">
          <div className="profit-calc-example-head">Harga Jual {money(minPrice)} atau lebih</div>
          <div className="profit-calc-example-body">
            <div className="profit-calc-example-status profit-calc-example-status--good">
              <CheckCircle2 size={12} />
              Profit sesuai target
            </div>
            <div className="profit-calc-example-label">Estimasi Profit per Pcs</div>
            <b className="profit-calc-example-value profit-calc-example-value--good">
              {money(profitMin)}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}

