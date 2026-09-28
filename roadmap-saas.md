# Catatan SaaS — Riset & Arah Menuju Subscriber

> Catatan informal untuk diskusi mitra. Bukan rencana teknis final, belum ada perubahan kode.
> Sumber riset: pencarian Google (artikel founder, IndieHackers, Clerk/WorkOS/Microsoft docs), diskusi komunitas (Reddit r/Supabase, GitHub Supabase discussion), YouTube (video "database per tenant vs shared"), dan pasar POS Indonesia (Kasair, KasirPro, iReap, Moka, Qasir, dll).

---

## 1. Inti Masalahnya: Subscription, Bukan Fitur

Pola yang paling sering muncul dari pengalaman founder SaaS (IndieHackers, podcast, thread):

- **Yang bikin gagal bukan teknologi.** Produk dibangun rapi, tapi tidak ada yang rela bayar karena masalah yang dipecahkan tidak "sakit" cukup.
- **Pelanggan pertama didapat dengan cara manual.** Outreach langsung, demo personal, kenalan/komunitas. Bukan ads, bukan fitur baru.
- **Churn terbesar terjadi di 14 hari pertama.** Onboarding yang buruk = subscriber hilang sebelum sadar nilainya.
- **Distribusi harus divalidasi sebelum dibangun lebih jauh.** Kalau tidak ada jalur jelas dari "owner toko tahu produk ini" → "owner toko bayar bulanan", fitur sebanyak apa pun tidak membantu.

**Konsekuensi untuk kita:** pertanyaan diskusi mitra bukan "fitur apa lagi yang dibangun", tapi "siapa owner pertama yang rela bayar, dan bagaimana mereka tahu kita ada?"

---

## 2. Pasar yang Kita Bidik: POS/Kasir UMKM Indonesia

Dari riset pasar POS lokal ( harga publik di website mereka):

| Produk | Harga langganan | Catatan |
|---|---|---|
| Kasair POS | Rp 60.000/bulan | Semua fitur, langganan fleksibel bulanan |
| KasirPro | Rp 49.000/bulan (100 transaksi/hari) | Tier atas Rp 89.000/bulan (1.000 transaksi) |
| iReap POS | Ada versi gratis + berbayar | Freemium untuk masuk pasar |
| Moka POS (GOTO) | Lebih tinggi, enterprise-ish | Bagian ekosistem besar |
| Qasir, Kasir Pintar, BukuWarung, Bee | Range serupa, banyak yang freemium | Pasar sangat padat |

**Kesimpulan pasar:**
1. Harga wajar di pasar: **Rp 50–100 ribu/bulan** untuk UMKM. Di bawah itu sulit cover biaya, di atas itu butuh value jelas (mis. multi-outlet, laporan pajak).
2. Pasar **sangat padat** — pemain besar (GOTO/Moka) dan puluhan pemain kecil. Kita tidak menang dengan "aplikasi kasir". Kita harus punya sudut pandang berbeda (mis. **dashboard multi-channel**: POS + invoice + laporan terpadu untuk pemilik yang punya lebih dari satu kanal).
3. Pain point owner yang paling sering disebut: **pencatatan manual, stok tidak akurat, transaksi lambat, laporan tercecer antar kanal.** Ini persis yang modul-modul kita tuju.

---

## 3. Arsitektur: Kapan Multi-Tenant / Multi-DB Masuk

Dari diskusi komunitas Supabase & dokumentasi vendor, ada 3 pola standar:

1. **DB terpisah per tenant** — isolasi paling kuat, biaya paling mahal, migrasi harus jalan di setiap DB.
2. **Satu DB, schema terpisah per tenant** — tengah-tengah, tapi manajemen schema jadi berat.
3. **Satu DB, satu schema, tenant dipisah kolom `workspace_id` + RLS** — standar Supabase untuk B2B SaaS, paling murah, paling mudah dioperasikan.

**Posisi kode kita sekarang:**
- ✅ Sudah ada fondasi bagus: 17 tabel dengan **RLS aktif semua**, auth JWT + role, guard `requireWriteAccess` di semua route tulis, sistem modul (7 modul terdaftar), test suite 23 test.
- ❌ Yang belum ada: kolom `workspace_id`, wiring tenant, billing, onboarding, audit log, rate limiting.

**Rekomendasi pragmatis (opini web developer):**
- Sekarang (pengguna tunggal / demo): **tetap satu DB, tidak ada yang perlu diubah.**
- Saat mulai ada 1–3 tenant nyata (bahkan gratis/pilot): tambah `workspace_id` + kebijakan RLS per tenant. Pola #3. Ini kerja yang bisa bertahap, tidak perlu "migrasi besar".
- DB terpisah per tenant (project spesialis Supabase): **jangan**, kecuali ada alasan nyata — klien besar menuntut isolasi ketat, kebutuhan regulasi/audit, atau biaya satu project besar sudah lebih mahal dari beberapa project kecil. Split dulu sebelum ada revenue = kompleksitas tanpa pemasukan.

---

# BAGIAN 2 — PELUANG KEDUA: CREATOR AFFILIATE

> Latar: sekarang sedang tren semua orang bisa cari uang via affiliate — marketplace Indonesia (Shopee, TikTok, Lazada, Threads/Meta) sampai global (YouTube, Amazon, eBay, Etsy). Yang bisa **membaca peluang lebih dulu** yang menang — artinya mereka butuh **data lebih cepat dan lebih lengkap dari kompetitor**. Di sinilah kita masuk.

## 4. Peluang Affiliate: Masalah, Posisi, Alur Produk

### Masalah nyata para affiliate (konsisten di YouTube/TikTok/Threads/FB)
1. **Komisi tiba-tiba nol / tidak valid** — keluhan #1; order batal/ditolak tanpa transparansi, ketahuan setelah kejadian.
2. **Link kalah last-click** — share duluan tapi komisi diambil orang lain (tracking tertimpa, window 7 hari).
3. **Data tersebar** — Shopee satu app, TikTok satu, Lazada satu; tidak ada satu layar gabungan.
4. **Tidak tahu konten mana yang perform** — platform kasih angka, tidak menghubungkan ke konten/link.
5. **Tracking manual di spreadsheet** — error, capek, tidak real-time.

### Posisi kita (penting!)
> **Platform tempat mereka bekerja (Shopee/TikTok), dashboard kita tempat mereka berpikir.**

- Kita TIDAK menggantikan fitur "cari produk → generate link → share" (itu tugas platform).
- Kita adalah **lapisan laporan & keputusan**: gabungan semua platform + histori + saran.
- Kita TIDAK minta password marketplace (aman, tidak langgar ketentuan). Data masuk via **export CSV** (fitur bawaan platform yang sudah ada).
- Datanya memang sudah ada di dashboard masing-masing platform — dan itu kabar baik: data pasti bisa keluar. Yang dibayar adalah **gabungan + kemudahan membaca + saran**, seperti aplikasi pencatat keuangan yang menggabungkan semua rekening bank.

### Perbandingan dengan dashboard platform
| Yang mereka butuhkan | Dashboard Shopee | Dashboard TikTok | Kita |
|---|---|---|---|
| Lihat komisi per produk | ✅ (hanya Shopee) | ✅ (hanya TikTok) | ✅ gabungan |
| Bandingkan tren 3 bulan antar produk | ⚠️ terbatas | ⚠️ terbatas | ✅ histori utuh |
| Total gabungan semua platform | ❌ | ❌ | ✅ |
| Peringatan order bermasalah | ❌ (pasif) | ❌ (pasif) | ✅ aktif |
| "Konten mana yang harus dibikin lagi" | ❌ | ❌ | ✅ |

### Alur kerja user
- **Sekali di awal:** centang platform yang dipakai (Shopee ✅ TikTok ✅). Selesai. Tidak ada login marketplace.
- **Mingguan (5–10 menit):** download laporan CSV dari app Shopee/TikTok Affiliate → drag & drop ke dashboard → otomatis dirapikan.
- **Harian (1 menit):** buka satu layar: *bulan ini komisi Rp X, pending Rp Y, ada 2 order bermasalah* → tutup.
- **Katalog produk terbentuk OTOMATIS** dari import — tidak ada input produk manual. Setiap baris CSV berisi nama produk, harga, rate, komisi, status → dashboard menyatukannya jadi katalog pribadi + tren naik/turun.

### Layar MVP modul Affiliate
1. **Ringkasan** — total komisi, pending, valid, batal + chart tren bulanan
2. **Produk** — katalog otomatis dari import, sortable "top earner"
3. **Konten/Link** — performa per video/link yang dicatat
4. **Import** — upload CSV (deteksi format otomatis)
5. **Perlu Perhatian** — order pending/bermasalah (penyelamat komisi)

### Kendala API (jujur-jujurnya)
| Platform | API data komisi creator |
|---|---|
| TikTok Shop | ✅ Ada Affiliate API (Open Platform), mostly seller-side; creator earnings perlu verifikasi |
| Shopee | ⚠️ Open Platform untuk seller; **creator commission report tidak ada API publik** → CSV manual |
| Amazon/eBay/Etsy | ✅ Ada, tapi bersyarat (Amazon PA-API butuh sales dulu) |

**Konsekuensi:** MVP wajib nyaman dengan input CSV/manual. Justru jadi moat: tools yang merapikan data berantakan.

---

## 5. Kenapa Mereka Mau Bayar (Amunisi Pitch Utama)

**Prinsip: mereka TIDAK membayar untuk "dashboard". Mereka membayar untuk uang yang bertambah atau uang yang tidak hilang.**

| Tanpa dashboard kita | Dengan dashboard kita |
|---|---|
| 15 menit/hari cek app Shopee + catat | Satu layar, semua angka ada |
| 15 menit/hari cek app TikTok + catat | Histori utuh, tren terlihat |
| Komisi hangus ketahuan SETELAH kejadian | Alert SEBELUM — masih bisa diperbaiki |
| Bikin konten pakai tebakan | Tahu konten mana yang bawa duit |
| Total ±5–7 jam/minggu kerja admin | Waktu itu jadi konten baru → penghasilan naik |

**Hitungan kasar (contoh "Budi", creator penghasilan Rp 3jt/bulan):**
- Langganan kita: **Rp 29rb/bulan**
- Geser usaha ke konten yang benar (naik 10% konservatif): **+Rp 300rb/bulan**
- Alert menyelamatkan 1–2 komisi bermasalah: **+Rp 100–200rb/bulan**
- **Bayar 29rb → balik ±400rb (10x).** Aturan SaaS: orang bayar kalau alat mengembalikan 3–10x harganya.

**Siapa yang TIDAK akan bayar (jujur):** creator baru penghasilan Rp 0–300rb/bulan — Rp 29rb terasa mahal. Bukan target (paling banter tier gratis terbatas). **Target: creator Rp 2jt+/bulan** atau pemilik toko multi-kanal — kehilangan satu komisi saja sudah lebih mahal dari setahun langganan.

**Pricing natural: Rp 29–49rb/bulan** (di bawah POS karena audience lebih luas & muda). Overlap dengan user POS: pemilik toko yang juga affiliate = bayar dua value, satu produk.

> Kalimat kunci: *"Mereka butuh tahu: (1) duit saya datang dari konten mana, (2) komisi mana yang berisiko hangus, (3) total saya bulan ini — tanpa buka 5 aplikasi."*

---

## 6. Fitur Pembeda yang Lebih Powerful (Fase 2+, pilih berdasarkan bukti)

1. **Alert WhatsApp** — notifikasi order bermasalah/komisi masuk via WA. Paling cocok pasar Indonesia (WA = nyawa komunikasi). Penyelamat komisi real-time.
2. **Mode Agensi/MCN** — satu akun mengelola banyak creator (agensi talenta TikTok/Shopee). **Paling powerful secara bisnis**: satu klien = puluhan seat, harga jauh lebih besar (B2B).
3. **AI Insight** — rekomendasi otomatis dari data: "video review skincare konversi 3x lipat, bikin lagi", "produk ini tren turun 3 minggu". Paling trendy, paling gampang di-pitch.
4. **Laporan penghasilan siap pajak** — rekap PDF bulanan semua platform. Value untuk creator serius.
5. **Deteksi last-click loss** — indikasi link tertimpa/kalah tracking. Sulit dibangun, tapi moat terbesar kalau berhasil.
6. **White-label report** — creator yang lapor ke brand/klien bisa kirim report atas nama mereka.

**Aturan:** semua ini FASE 2. Bangun hanya setelah MVP (Bagian 4) terbukti dipakai rutin. Jangan bangun fitur powerful di atas produk yang belum divalidasi.

---

## 7. Peta Jalan Kasar Menuju Subscriber (urutan, bukan tanggal)

1. **Fase "Satu Owner Nyata"** — tanpa multi-tenant.
   - Temukan 1–3 owner toko nyata yang pakai versi sekarang secara rutin (gratis/berbayar manual).
   - Ukur: apakah mereka kembali pakai tiap hari? Apa yang mereka komplain?
   - Ini "validasi distribusi" — jual dulu secara manual, baru otomatisasi.
2. **Fase "Berbayar Pertama"** — masih satu DB.
   - Pricing sederhana: 1 tier Rp 50–99rb/bulan (ambil tengah pasar).
   - Onboarding 14 hari pertama dibikin mulus: data contoh, panduan singkat, WhatsApp support.
   - Pembayaran: bisa manual dulu (transfer + aktivasi oleh kita). Billing otomatis (Midtrans/Xendit) datang setelah ada bukti orang mau bayar.
3. **Fase "Multi-Tenant"** — baru sentuh DB.
   - Tambah `workspace_id`, kebijakan RLS per tenant, onboarding self-service.
   - Billing otomatis, audit log, rate limiting.
4. **Fase "Scale / Split"** — hanya kalau dipicu nyata.
   - Isolasi ketat per klien besar, regulasi, atau biaya. Baru bicara project spesialis / DB per tenant.

**Aturan praktis:** setiap fase baru hanya boleh dimulai kalau fase sebelumnya punya bukti (ada pengguna rutin → ada yang bayar → ada yang churn → baru otomatisasi/scale).

---

## 8. Pertanyaan untuk Diskusi Mitra

1. **Siapa owner pertama kita?** Punya kenalan pemilik toko/kafe/multi-channel yang mau jadi pilot?
2. **Apa sudut pandang kita?** Di pasar yang padat ini, "aplikasi kasir" tidak cukup — apakah "dashboard multi-channel terpadu" (yang sudah kita bangun) adalah diferensiasi yang owner pedulikan?
3. **Berapa harga yang mereka rela bayar?** Benchmark pasar Rp 50–100rb/bulan. Minta pendapat mitra yang dekat dengan UMKM.
4. **Siapa yang pegang peran jualan/onboarding manual?** Pelanggan pertama hampir pasti datang dari relasi personal, bukan dari internet.
5. **Berapa lama kita siap menahan biaya tanpa subscriber?** Ini menentukan seberapa cepat kita harus ke Fase 2.

---

## 9. Ringkasan Satu Paragraf

Produk dan fondasi teknis kita sudah lebih siap dari kebanyakan SaaS di titik ini (auth, RLS, modul, test). Yang belum terbukti bukan teknologinya, tapi **jalur menuju subscriber pertama**. Riset pasar dan pengalaman founder lain menunjukkan: cari 1–3 owner nyata dulu secara manual, buktikan mereka kembali pakai dan rela bayar Rp 50–100rb/bulan, baru tambah multi-tenant (`workspace_id` + RLS) dan billing otomatis. DB terpisah/project spesialis menunggu sampai ada alasan bisnis nyata, bukan sekarang.

Selain pasar POS, ada peluang segmen kedua yang lebih muda dan sedang naik: **creator affiliate** (lihat Bagian 4–6). Keduanya bisa berbagi satu produk: pemilik toko yang juga jualan via affiliate adalah user yang membayar dua value sekaligus.
