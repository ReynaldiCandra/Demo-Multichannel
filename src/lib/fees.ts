/**
 * Biaya platform otomatis = persentase toko × omzet transaksi (setelah diskon),
 * dibulatkan ke rupiah. Dipakai server (menyimpan) dan form (pratinjau) agar hasilnya sama.
 */
export function autoPlatformFee(
  feePercent: number | string,
  qty: number,
  actualPrice: number,
  discount: number,
): number {
  const revenue = Math.max(qty * actualPrice - discount, 0);
  return Math.round((revenue * (Number(feePercent) || 0)) / 100);
}
