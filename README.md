# Dashboard Pribadi

Dashboard untuk mengelola POS dropship, jobs freelance, tes Meta Ads manual, live selling, dan ledger profit bulanan.

## Foto produk, supplier, dan transaksi

Project ini membutuhkan migration `0005_product_supplier_image.sql` dan
`0006_supplier_sale_image.sql`. Migration tersebut menambahkan tabel supplier,
relasi supplier-produk, serta kolom foto pada produk, supplier, dan transaksi.
Jalankan migration **berurutan** di Supabase SQL Editor sebelum membuka halaman
Daftar Supplier, Produk & Stok, atau Input Harian. Keduanya idempoten, jadi aman
dijalankan ulang.

Jika database sudah pernah dipakai sebelum fitur supplier/foto ditambahkan,
jalankan file `0003_suppliers.sql`, `0004_safe_reporting_indexes_and_suppliers.sql`,
`0005_product_supplier_image.sql`, lalu `0006_supplier_sale_image.sql`.
Setelah itu restart `npm run dev`.

Foto produk diunggah ke **Vercel Blob**, bukan ke filesystem server. Isi
`BLOB_READ_WRITE_TOKEN` di environment Vercel dan lokal. Browser mengecilkan
foto maksimal 1200 px lalu mengonversinya ke WebP sebelum upload untuk menjaga
bandwidth tetap efisien.

## Batch CRUD (lanjutan)

Batch lanjutan menambahkan edit, hapus, dan aktif/nonaktif untuk master data
toko/produk, status job, penghapusan transaksi, edit/hapus tes Meta Ads, serta
edit/hapus dan aktif/nonaktif untuk host dan sesi live. Penghapusan dibuat aman:
master data yang sudah dipakai transaksi tidak bisa dihapus paksa agar riwayat
omzet tetap utuh; nonaktifkan item tersebut sebagai gantinya.

Batch #10 menambahkan pengaturan modul. Owner bisa menyalakan atau mematikan
modul dari `/pengaturan`; modul nonaktif disembunyikan dari sidebar tanpa
menghapus data. Dashboard adalah modul inti dan selalu aktif. Akun demo hanya
bisa melihat pengaturan dan tidak bisa mengubah modul.

Stack: **Next.js 15 (App Router) · TypeScript · Drizzle ORM · Supabase Postgres · TanStack Query · Tailwind v4**. Dirancang untuk deploy ke Vercel.

---

## Login & akun

Aplikasi sekarang terkunci — semua halaman dan API butuh login.

| Akun | Hak akses |
|---|---|
| `owner` | Akses penuh: lihat, tambah, ubah |
| `demo` | **Hanya melihat.** Semua aksi tulis ditolak di server dengan 403 |

Akun dibuat lewat `npm run db:seed`, email dan passwordnya diatur dari `.env.local`
(`SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_DEMO_PASSWORD`).

Akun demo ditolak di **server**, bukan cuma disembunyikan tombolnya di UI — jadi
tidak bisa diakali lewat curl atau devtools. Ini yang membuatnya aman dipakai
untuk memberi demo ke owner lain.

`AUTH_SECRET` wajib diisi minimal 32 karakter, buat dengan `openssl rand -base64 32`.
Tanpa itu aplikasi menolak jalan.

---

## Struktur toko: satu brand, banyak kanal

Satu baris toko = satu brand di satu kanal. "Sora & Soul" di Shopee, Lazada, dan
TikTok Shop adalah **tiga baris** dengan `name` sama dan `channel` berbeda.

Versi sebelumnya memberi constraint UNIQUE pada nama toko, sehingga satu brand
hanya bisa muncul sekali dan kamu terpaksa menulis kanal di dalam nama
("Sora & Soul (Shopee)"). Sekarang constraint-nya `unique(name, channel)`, jadi
omzet bisa dibaca dua arah: per kanal, dan digabung per brand.

---

## 1. Siapkan database di Supabase

1. Buka [supabase.com](https://supabase.com) → **New project**. Pilih region **Southeast Asia (Singapore)** biar latensi dari Indonesia rendah. Catat password database yang kamu buat — password ini hanya ditampilkan sekali.
2. Setelah project jadi, buka **SQL Editor** → **New query**.
3. Copy seluruh isi file `supabase/migrations/0000_init.sql`, paste, lalu **Run**. Ini membuat tabel inti beserta index dan mengaktifkan RLS.
   Lalu jalankan **berurutan** file `0001_perf_indexes.sql`, `0002_sales_status_order_fee.sql`, `0003_suppliers.sql`, `0004_safe_reporting_indexes_and_suppliers.sql`, `0005_product_supplier_image.sql`, dan `0006_supplier_sale_image.sql` dengan cara yang sama. Semua migration aman dijalankan berulang. Migration terakhir juga memastikan tabel supplier tersedia pada database yang sebelumnya belum menjalankan migration supplier, serta menambahkan index laporan yang aman.
4. Ambil connection string: **Project Settings** → **Database** → bagian **Connection string** → tab **URI**.

Supabase memberi beberapa varian connection string. Yang dipakai:

| Keperluan | Pakai | Port |
|---|---|---|
| Aplikasi jalan (`DATABASE_URL`) | **Transaction pooler** | 6543 |
| Migrasi / seed (`DIRECT_URL`) | **Session pooler** | 5432 |

Transaction pooler wajib untuk serverless seperti Vercel — tiap request Vercel bikin koneksi baru, dan pooler yang menahan agar Postgres tidak kehabisan slot koneksi. Ganti `[YOUR-PASSWORD]` di string tersebut dengan password dari langkah 1.

## 2. Jalankan di lokal

```bash
npm install
cp .env.example .env.local     # isi DATABASE_URL, DIRECT_URL, dan AUTH_SECRET
npm run db:seed                # buat akun login, modul, dan daftar toko
npm run dev
```

`db:seed` wajib dijalankan minimal sekali — tanpa itu belum ada akun untuk login.

Buka http://localhost:3000.

Kalau kamu tidak mau seed, aplikasi tetap jalan dan menampilkan empty state di semua halaman. Mulai dengan menambah toko di `/pos/toko`, lalu produk di `/pos/produk`, baru bisa mencatat penjualan.

## 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Migrasi dashboard ke Next.js + Supabase"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

`.env.local` dan `.env` sudah masuk `.gitignore`, jadi password database tidak ikut ter-push. Pastikan tetap begitu.

## 4. Deploy ke Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import repo GitHub tadi.
2. Framework preset terdeteksi otomatis sebagai Next.js. Build command dan output directory biarkan default.
3. Sebelum klik Deploy, buka **Environment Variables** dan tambahkan:
   - `DATABASE_URL` → connection string **transaction pooler** (port 6543)
   - `DIRECT_URL` → connection string **session pooler** (port 5432)
   - `AUTH_SECRET` → hasil `openssl rand -base64 32`
   - `BLOB_READ_WRITE_TOKEN` → token dari Vercel Blob Store untuk upload foto

   Centang keempat environment (Production, Preview, Development).
4. **Deploy**.

Kalau nanti kamu mengubah environment variable, Vercel butuh **Redeploy** agar perubahannya terpakai — mengubah nilainya saja tidak cukup.

## 5. Kerja di Cursor tanpa AI

Proyek ini sengaja tidak memakai codegen atau tooling khusus, jadi semuanya bisa dikerjakan manual:

```bash
npm run dev         # server pengembangan
npm run typecheck   # cek TypeScript
npm run build       # build produksi, jalankan sebelum push kalau ragu
npm run db:push     # dorong perubahan schema ke database (dev)
npm run db:studio   # GUI untuk lihat isi tabel
```

Kalau Cursor menampilkan error import `@/...`, restart TypeScript server: `Cmd/Ctrl+Shift+P` → "TypeScript: Restart TS Server".

---

## Struktur proyek

```
src/
├── app/
│   ├── api/              # Route Handlers — pengganti server Express
│   │   ├── dashboard/    #   GET  /api/dashboard?month=YYYY-MM
│   │   ├── stores/       #   GET POST /api/stores, PATCH /api/stores/[storeId]
│   │   ├── products/     #   GET POST /api/products, PATCH /api/products/[productId]
│   │   ├── sales/        #   GET POST /api/sales
│   │   ├── meta-ads/     #   GET POST /api/meta-ads, PATCH /api/meta-ads/[id]
│   │   ├── jobs/         #   + /[jobId]/costs dan /[jobId]/payments
│   │   ├── hosts/        #   GET POST /api/hosts
│   │   ├── live-sessions/
│   │   └── reports/ledger/
│   ├── page.tsx          # Dashboard
│   ├── pos/              # Penjualan, produk, toko
│   ├── meta-ads/ jobs/ live/ laporan/ pengaturan/
│   ├── layout.tsx        # Shell + provider
│   └── globals.css       # Seluruh styling (dibawa utuh dari proyek lama)
├── components/           # AppShell, primitif UI, error boundary
└── lib/
    ├── api/              # Hooks TanStack Query + tipe response
    ├── db/               # Schema Drizzle + koneksi
    └── server/           # Logika domain, validasi Zod, helper HTTP
```

## Catatan migrasi dari versi Vite

- **Monorepo jadi satu app.** Lima paket pnpm (`dashboard-pribadi`, `api-server`, `db`, `api-spec`, `api-client-react`) digabung jadi satu proyek Next.js.
- **Express → Route Handlers.** Semua logika perhitungan dipertahankan persis: snapshot modal saat penjualan dibuat, ledger bulanan cash-basis, status overdue, CPL dan cost-per-closing.
- **Orval/OpenAPI dihapus.** Client API sekarang ditulis tangan di `src/lib/api/hooks.ts` dengan nama hook yang sama persis (`useListSales`, `useCreateJob`, dst.), jadi tidak ada lagi langkah `codegen` tiap kali mengubah kontrak API.
- **wouter → file-based routing.** `/jobs/:id` jadi `app/jobs/[id]/page.tsx`.
- **node-postgres → postgres-js** dengan `prepare: false`. Ini wajib karena transaction pooler Supabase tidak mendukung prepared statement.
- **shadcn/ui dibuang.** Dari 60+ komponen, ternyata hanya `TooltipProvider` dan `Toaster` yang pernah di-import — styling aplikasi sepenuhnya pakai CSS sendiri. Ini memangkas sekitar 30 dependency Radix. Kalau nanti butuh, komponennya masih ada di proyek lama dan tinggal disalin.
- **Perbaikan bug.** Di versi lama, PATCH mengirim seluruh objek sehingga field yang tidak diubah tetap ikut tertulis. Di versi ini `parsePatch()` hanya memakai key yang benar-benar dikirim — tanpa itu, "Tandai dibayar" di halaman live selling akan menolkan omzet dan komisi sesi tersebut.

## Keamanan

RLS diaktifkan di semua tabel tanpa policy. Artinya tabel tidak bisa dibaca publik lewat anon key Supabase, sementara server Next.js tetap punya akses penuh karena terhubung lewat connection string.

Autentikasi sudah terpasang: sesi JWT disimpan di cookie `httpOnly`, password
di-hash dengan bcrypt, dan middleware melindungi semua rute kecuali `/login`.
Pesan error login sengaja dibuat sama untuk email salah maupun password salah,
supaya tidak bisa dipakai menebak email mana yang terdaftar.

Yang masih perlu dipertimbangkan kalau dipakai lebih dari satu orang:
rate limiting pada endpoint login (saat ini belum ada, jadi brute force tidak
dibatasi), dan rotasi `AUTH_SECRET` secara berkala.
