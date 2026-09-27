# Roadmap Perbaikan Dashboard EXI

Dokumen acuan bersama. Diupdate setiap fase selesai — jangan dihapus,
supaya progres dan alasan keputusan tetap tercatat.

## Urutan disepakati

Realtime sync (Fase 2) dan Upload foto Produk & Stok (Fase 3) sempat
dilewati dulu untuk merancang Penjualan lanjutan (Fase 4), lalu
diputuskan balik ke urutan: **Fase 2 → Fase 4 (lanjutan)**.

## Status fase

| # | Fase | Status | Catatan |
|---|------|--------|---------|
| 1 | Routing/struktur menu | ✅ Selesai | Penjualan & Invoice punya route sendiri; icon Analisa Toko vs Kanal & Toko tidak nabrak lagi |
| 2 | Realtime sync | ✅ Selesai | `refetchOnWindowFocus: true` global + `refetchInterval` 60 detik di `useGetDashboardSummary`; tinggal verifikasi manual terakhir di browser |
| 3 | Upload foto Produk & Stok | ✅ Selesai | Root cause sudah berlapis selesai: (1) `BLOB_READ_WRITE_TOKEN` kosong di `.env.local`, lalu (2) Blob store pertama dibuat private sehingga `put(access: 'public')` ditolak — diselesaikan dengan store **public** + token baru. Upload end-to-end terverifikasi lokal: file masuk ke Blob, URL publik hidup, tersimpan di produk, dan tampil. Untuk production: pastikan token yang sama ada di Environment Variables Vercel lalu redeploy |
| 4 | Penjualan lanjutan | ✅ Selesai | Halaman kelola/audit `/pos/penjualan`: KPI ringkasan (omzet/profit/HPP/pcs dari transaksi selesai, mengikuti filter aktif), tabel + tab status + search + pagination, dan panel detail per transaksi (foto bukti, rincian angka, kartu produk/foto, supplier + link WhatsApp). Input Harian `/pos` tetap ringkas tanpa panel detail |
| 5 | Settlement | ✅ Selesai | Tab Settlement di `/laporan`: dana netto per toko dihitung live (penjualan selesai − biaya platform, konsisten dengan ledger), KPI belum/sudah cair, tandai cair dengan nominal riil dari marketplace (hybrid) + tanggal cair, bisa dibatalkan. Skema: tabel `settlements` (migration `0007_settlements.sql`, sudah di-apply ke database) |
| 6 | Invoice | ✅ Selesai | CRUD custom di `/invoice` (nomor unik, judul, klien/penerbit + alamat, tanggal/tempo, deskripsi, scope kerja, logo upload, item bebas qty desimal, pembayaran DP/cicilan/pelunasan, catatan). Status lunas otomatis dari sisa tagihan. Dokumen siap cetak di `/invoice/[id]` + export PDF via print browser. Skema: `invoices`, `invoice_items`, `invoice_payments` (migration `0008_invoices.sql`, sudah di-apply) |
| 7 | Ganti `window.confirm()` → `ConfirmDialog` | ✅ Selesai | Dialog konfirmasi in-app (gaya sama dengan modal lain) di semua lokasi: Produk & Toko (`master-page.tsx`), Live (host & sesi), Meta Ads, Supplier, Jobs, Input Harian (`/pos`), Penjualan (`/pos/penjualan`), Invoice, dan Batalkan status cair di Settlement. Tidak ada lagi `window.confirm` di kode aktif |
| 8 | Kanban tugas (to-do) | ✅ Selesai | `/kanban`: papan tugas bebas 3 kolom (Belum → Sedang → Selesai) dengan drag & drop native (HTML5, tanpa dependency), urutan dalam kolom via posisi sisipan, prioritas + tenggat (merah kalau lewat), catatan, edit/hapus via ConfirmDialog, tombol tambah per kolom. Kartu `done` mencatat `completed_at` otomatis. Modul `kanban` terdaftar (bisa dimatikan dari Pengaturan). Skema: tabel `tasks` (migration `0009_tasks.sql`, sudah di-apply) |

## Fase 2 — Realtime sync: diagnosis

Root cause ditemukan di `src/app/providers.tsx` dan `src/lib/api/hooks.ts`:

- `QueryClient` global diset `refetchOnWindowFocus: false` dan tanpa
  `refetchInterval` default.
- `useGetDashboardSummary` (dipakai KPI utama di `/`) tidak punya
  `refetchInterval` sama sekali.
- Akibatnya: begitu data pertama kali diambil, React Query tidak akan
  mengambil ulang data secara otomatis kecuali komponennya remount
  (pindah halaman lalu balik, atau reload manual). Kalau tab dashboard
  dibiarkan terbuka berhari-hari tanpa reload, angka yang tampil ya
  angka lama.
- API `/api/dashboard` sendiri sudah benar (`force-dynamic`, tidak ada
  cache di server, query tanggal berbasis `Asia/Jakarta`) — jadi bug
  ini murni di sisi client, bukan di data/server.

### Perbaikan yang dilakukan

1. `src/app/providers.tsx` — `refetchOnWindowFocus` diaktifkan lagi
   secara global, supaya semua halaman (bukan cuma dashboard) otomatis
   menyegarkan data begitu tab dibuka lagi.
2. `src/lib/api/hooks.ts` — `useGetDashboardSummary` ditambah
   `refetchInterval` 60 detik, senada dengan banner insight yang sudah
   duluan punya interval serupa.
3. Tambahan terkait cache: mutasi penjualan (create/update/delete) dan
   supplier (create/update/delete) kini juga meng-invalidasi scope
   `products`, supaya agregat stok/supplier di daftar produk ikut
   segar setelah ada perubahan.

## Fase 3 — Upload foto: diagnosis (terkonfirmasi & selesai)

- Kode upload sudah lengkap sejak awal (`master-page.tsx`,
  `suppliers/page.tsx`, `pos/_shared.tsx` + endpoint
  `/api/uploads/image` dan `/api/uploads/product-image`).
- Migration `0005_product_supplier_image.sql` dan
  `0006_supplier_sale_image.sql` sudah ter-apply — kolom
  `products.image_url`, `sales.image_url`, `suppliers.image_url` ada.
- Root cause lapis 1: `BLOB_READ_WRITE_TOKEN` tidak ada di `.env.local`
  — terbukti lewat tes langsung; sekarang sudah diisi.
- Root cause lapis 2: Blob store pertama dibuat **private**, sedangkan
  aplikasi mengunggah `access: 'public'` supaya foto bisa ditampilkan
  langsung di `<img>`. Pesan error jelas dari try/catch:
  "Cannot use public access on a private store". Diselesaikan dengan
  store **public** + token baru.
- Verifikasi end-to-end lokal (lulus semua): upload → URL publik 200 →
  tersimpan di produk (`imageUrl`) → foto tampil; data uji dipulihkan.
- Langkah production: samakan `BLOB_READ_WRITE_TOKEN` (dari store
  public) di Environment Variables Vercel, lalu redeploy.

## Fase 4 — Penjualan lanjutan: catatan struktur

- `src/app/penjualan/` sempat salah taruh di root `src/app/` sehingga
  typecheck gagal (import `../_shared` tidak resolve). Sudah dipindah
  ke `src/app/pos/penjualan/` — sejalan dengan nav `/pos/penjualan` di
  `app-shell.tsx`.
- Komponen bersama (`SaleFormModal`, `SalesTable`, `SaleDetailPanel`,
  konstanta status) hidup di `src/app/pos/_shared.tsx`, dipakai Input
  Harian (`/pos`) dan Penjualan (`/pos/penjualan`).
- KPI ringkasan dihitung client-side dari hasil filter yang sedang
  tampil (hanya status selesai), senada dengan aturan ledger server.
- Panel detail (`SaleDetailPanel`) dibuka lewat tombol mata di tabel
  Penjualan; props `onDetail` pada `SalesTable` opsional, jadi Input
  Harian tidak ikut berubah. Panel menampilkan foto bukti, rincian
  qty × harga, diskon, biaya platform, HPP (snapshot modal), profit,
  kartu produk (foto + harga), dan supplier (foto + kategori/kota +
  link wa.me).
