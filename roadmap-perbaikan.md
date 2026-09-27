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
| 3 | Upload foto Produk & Stok | 🔨 Tinggal env var | Kode upload dan migration 0005/0006 sudah lengkap; kolom `image_url` terverifikasi ada di database. Root cause terkonfirmasi: `BLOB_READ_WRITE_TOKEN` kosong di `.env.local`. Route upload sekarang memberi pesan error yang jelas. Tinggal isi token di `.env.local` + Vercel (lalu redeploy), dan tes upload |
| 4 | Penjualan lanjutan | 🔨 Dikerjakan | Folder salah taruh sudah dibetulkan: halaman kelola/audit jalan di `/pos/penjualan` (tabel, filter toko/bulan, tab status, search, pagination; komponen bersama di `src/app/pos/_shared.tsx`). Belum: ringkasan KPI + panel detail per transaksi (riwayat + kartu produk/foto/supplier) |
| 5 | Settlement | ⏳ Belum | `/laporan` saat ini isinya ledger/P&L, bukan status pencairan dana marketplace — butuh kolom skema baru |
| 6 | Invoice | ⏳ Belum (route ada) | Route `/invoice` sudah ada + terpasang di menu, masih placeholder. Butuh custom CRUD (logo, scope kerja, item, total, deskripsi) + export PDF |
| 7 | Ganti `window.confirm()` → `ConfirmDialog` | ⏳ Belum | Dipakai di Produk, Toko, Supplier, Live, Jobs, Meta Ads (`master-page.tsx`), plus Input Harian (`/pos`) dan Penjualan (`/pos/penjualan`) |

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

## Fase 3 — Upload foto: diagnosis (terkonfirmasi)

- Kode upload sudah lengkap sejak awal (`master-page.tsx`,
  `suppliers/page.tsx`, `pos/_shared.tsx` + endpoint
  `/api/uploads/image` dan `/api/uploads/product-image`).
- Migration `0005_product_supplier_image.sql` dan
  `0006_supplier_sale_image.sql` sudah ter-apply — kolom
  `products.image_url`, `sales.image_url`, `suppliers.image_url` ada.
- Root cause: `BLOB_READ_WRITE_TOKEN` tidak ada di `.env.local`.
  Terbukti lewat tes langsung: POST file ke endpoint upload membalas
  500 dengan pesan konfigurasi penyimpanan.
- Kedua route upload sekarang membungkus `put()` dengan try/catch dan
  mengembalikan pesan yang menjelaskan penyebabnya, bukan 500 generik.
- Langkah user selanjutnya: buat token Read-Write di Vercel → Storage
  → Blob store, isi di `.env.local` dan Environment Variables Vercel,
  redeploy, lalu tes upload produk dari menu Produk & Stok.

## Fase 4 — Penjualan lanjutan: catatan struktur

- `src/app/penjualan/` sempat salah taruh di root `src/app/` sehingga
  typecheck gagal (import `../_shared` tidak resolve). Sudah dipindah
  ke `src/app/pos/penjualan/` — sejalan dengan nav `/pos/penjualan` di
  `app-shell.tsx`.
- Komponen bersama (`SaleFormModal`, `SalesTable`, konstanta status)
  hidup di `src/app/pos/_shared.tsx`, dipakai Input Harian (`/pos`)
  dan Penjualan (`/pos/penjualan`).
- Belum dibuat: ringkasan KPI dan panel detail per transaksi.
