# Beta test checklist

Jalankan setelah `.env.local` diisi dan migrasi/seed selesai:

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Alur yang harus diuji di browser

1. **Login** — login owner berhasil, password salah menampilkan error, membuka `/` tanpa login diarahkan ke `/login`.
2. **Dashboard** — KPI, tren, aktivitas, dan laporan omzet tampil setelah database di-seed.
3. **POS** — buat/edit/nonaktifkan/hapus toko dan produk; coba hapus produk yang sudah punya penjualan dan pastikan aplikasi menolak dengan pesan aman.
4. **Penjualan** — catat transaksi, cek profit, hapus transaksi, lalu pastikan dashboard/laporan ikut berubah.
5. **Jobs** — buat/edit job, ubah ke selesai atau dibatalkan, tambah biaya dan pembayaran, cek detail/profit, lalu hapus job.
6. **Meta Ads** — buat/edit/hapus tes, ubah status running/completed/stopped, cek CPL dan cost per closing.
7. **Live Selling** — buat/edit/nonaktifkan/hapus host, catat/edit/hapus sesi, tandai komisi dibayar.
8. **Laporan** — ganti bulan dan pastikan ledger serta laporan per toko mengikuti data.
9. **Pengaturan** — matikan POS atau modul lain; menu modul hilang dari sidebar, nyalakan lagi; Dashboard tetap tidak bisa dimatikan.
10. **Mode demo** — login demo dapat membaca semua menu, tetapi seluruh aksi tulis ditolak server dengan HTTP 403.

Uji browser membutuhkan database PostgreSQL/Supabase yang sudah menjalankan
migrasi dan seed. `npm test` menguji kontrak validasi dan aturan filter modul
secara otomatis tanpa memerlukan database.