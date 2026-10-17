/**
 * Kalkulator Profit Marketplace.
 *
 * Satu sumber rumus untuk form produk (kalkulator), Input Harian (badge),
 * dan Penjualan (status target) — supaya angka yang terlihat pengguna selalu
 * sama dengan angka yang tersimpan di server.
 *
 * Rumus dasar per pcs:
 *   omzet      = harga − diskon
 *   fee        = omzet × fee%        (+ buffer safety margin %)
 *   profit     = omzet − fee − HPP
 *   harga min  = (HPP + target) ÷ (1 − fee% − buffer%)
 *
 * Mode volume: target dipenuhi per blok N pcs, jadi kalkulator menurunkan
 * "qty minimum per transaksi" daripada harga minimum.
 */

export type ProfitMode = 'per_pcs' | 'volume';

export type ProfitTargetInput = {
  mode: ProfitMode;
  /** HPP per pcs (modal produk). */
  hpp: number;
  /** Persentase fee marketplace toko (0–100). */
  feePercent: number;
  /** Margin keamanan global (%) — buffer fluktuasi biaya. */
  safetyMarginPercent?: number;
  /** Target profit per pcs; kosong = pakai default global. */
  targetProfitPcs: number;
};

export type ProfitTargetResult = {
  /** Target profit/pcs yang benar-benar dipakai (setelah fallback default). */
  effectiveTargetPcs: number;
  /** Harga jual minimum agar profit ≥ target (mode per_pcs). */
  minSellingPrice: number;
  /** Margin keamanan yang dipakai dalam hitungan (%). */
  safetyMarginPercent: number;
};

/**
 * Harga jual minimum agar profit bersih per pcs ≥ target.
 *   harga = (HPP + target) ÷ (1 − fee% − buffer%)
 * Dibulatkan ke atas ke ratusan terdekat supaya gampang diketik.
 */
export function calcMinSellingPrice({
  hpp,
  feePercent,
  safetyMarginPercent = 0,
  targetProfitPcs,
}: Omit<ProfitTargetInput, 'mode'>): ProfitTargetResult {
  const fee = clampPercent(feePercent);
  const buffer = clampPercent(safetyMarginPercent);
  const denominator = (100 - fee - buffer) / 100;
  // Denominator ≤ 0 berarti fee + buffer ≥ 100% — perhitungannya mustahil dipenuhi;
  // kembalikan tanpa pembulatan biar UI bisa menampilkan peringatan khusus.
  if (denominator <= 0) {
    const raw = hpp + targetProfitPcs;
    return {
      effectiveTargetPcs: targetProfitPcs,
      minSellingPrice: raw > 0 ? raw : 0,
      safetyMarginPercent: buffer,
    };
  }
  const raw = (hpp + targetProfitPcs) / denominator;
  return {
    effectiveTargetPcs: targetProfitPcs,
    minSellingPrice: Math.ceil(raw / 100) * 100,
    safetyMarginPercent: buffer,
  };
}

/**
 * Profit bersih per pcs pada harga tertentu, termasuk potongan fee% dan
 * safety buffer. Dipakai badge Input Harian dan Penjualan.
 */
export function calcProfitPerPcs({
  hpp,
  price,
  feePercent,
  safetyMarginPercent = 0,
  discountPerUnit = 0,
}: {
  hpp: number;
  price: number;
  feePercent: number;
  safetyMarginPercent?: number;
  /** Diskon per pcs (diskon transaksi ÷ qty). */
  discountPerUnit?: number;
}): number {
  const revenuePerPcs = price - discountPerUnit;
  const feeRate = (clampPercent(feePercent) + clampPercent(safetyMarginPercent)) / 100;
  return Math.round(revenuePerPcs - revenuePerPcs * feeRate - hpp);
}

/**
 * Qty minimum per transaksi agar target mode volume tercapai.
 *   profit/pcs pada harga tertentu → qty = ceil(target ÷ profit/pcs)
 * profit/pcs ≤ 0 berarti harga terlalu rendah untuk mode volume —
 * kembalikan null dan UI menampilkan saran naik harga, bukan angka mustahil.
 */
export function calcMinQtyForVolumeTarget({
  targetProfitBatch,
  batchQty = 1,
  pricePerPcs,
  hpp,
  feePercent,
  safetyMarginPercent = 0,
  discountPerUnit = 0,
}: {
  targetProfitBatch: number;
  /** Jumlah pcs yang sudah pasti dijual per order (batch). */
  batchQty?: number;
  pricePerPcs: number;
  hpp: number;
  feePercent: number;
  safetyMarginPercent?: number;
  discountPerUnit?: number;
}): number | null {
  const profitPerPcs = calcProfitPerPcs({
    hpp,
    price: pricePerPcs,
    feePercent,
    safetyMarginPercent,
    discountPerUnit,
  });
  if (profitPerPcs <= 0) return null;
  const orders = Math.max(1, batchQty);
  return Math.max(orders, Math.ceil(targetProfitBatch / profitPerPcs / orders) * orders);
}

/** Detil uraian kalkulator (panel "Detail Perhitungan" di form produk). */
export function explainMinPrice(input: Omit<ProfitTargetInput, 'mode'>) {
  const { minSellingPrice, effectiveTargetPcs, safetyMarginPercent } =
    calcMinSellingPrice(input);
  const feeRate = (clampPercent(input.feePercent) + safetyMarginPercent) / 100;
  const feePerPcs = Math.round(minSellingPrice * feeRate);
  return {
    minSellingPrice,
    effectiveTargetPcs,
    safetyMarginPercent,
    /** HPP yang dipakai. */
    hpp: input.hpp,
    /** Fee marketplace + buffer per pcs pada harga minimum. */
    feePerPcs,
    /** Sisa profit persis pada harga minimum (≈ target, bulatan ke ratusan). */
    profitAtMin: minSellingPrice - feePerPcs - input.hpp,
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

/**
 * Status satu produk untuk tampil di daftar produk: target profit yang dipakai,
 * harga jual minimum, dan apakah harga yang tersedia sudah mencukupi.
 * Dipakai tabel master produk ("Harga Min." & "Status target").
 */
export function productTargetStatus(input: {
  hpp: number;
  sellingPrice: number;
  feePercent: number;
  mode: ProfitMode;
  targetProfitPcs: number | null;
  targetProfitBatch: number | null;
  targetProfitBatchQty: number | null;
  defaultTargetPcs: number;
  safetyMarginPercent?: number;
}) {
  const effectiveTargetPcs = input.targetProfitPcs ?? input.defaultTargetPcs;
  const result = calcMinSellingPrice({
    hpp: input.hpp,
    feePercent: input.feePercent,
    safetyMarginPercent: input.safetyMarginPercent ?? 0,
    targetProfitPcs: effectiveTargetPcs,
  });

  if (input.mode === 'volume' && input.targetProfitBatch && input.targetProfitBatchQty) {
    const minQty = calcMinQtyForVolumeTarget({
      targetProfitBatch: input.targetProfitBatch,
      batchQty: input.targetProfitBatchQty,
      pricePerPcs: input.sellingPrice,
      hpp: input.hpp,
      feePercent: input.feePercent,
      safetyMarginPercent: input.safetyMarginPercent ?? 0,
    });
    const ok = minQty !== null && input.sellingPrice > 0 && input.targetProfitBatchQty! >= minQty;
    return {
      target: effectiveTargetPcs,
      mode: 'volume' as const,
      minSellingPrice: result.minSellingPrice,
      meetsTarget: ok,
      meta: minQty === null
        ? 'HPP terlalu tinggi atau fee ≥ 100%'
        : `Min. ${minQty} pcs/order agar profit ≥ ${moneyId(input.targetProfitBatch!)}`,
    };
  }

  const ok = input.sellingPrice > 0 && input.sellingPrice >= result.minSellingPrice;
  return {
    target: effectiveTargetPcs,
    mode: 'per_pcs' as const,
    minSellingPrice: result.minSellingPrice,
    meetsTarget: ok,
    meta: ok ? `Profit ${moneyId(calcProfitPerPcs({ hpp: input.hpp, price: input.sellingPrice, feePercent: input.feePercent, safetyMarginPercent: input.safetyMarginPercent ?? 0 }))} /pcs`
      : input.sellingPrice > 0
        ? `Naikkan ke ${moneyId(result.minSellingPrice)} /pcs`
        : 'Belum ada harga jual',
  };
}

function moneyId(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export type ProductTargetStatus = ReturnType<typeof productTargetStatus>;
