# Roadmap Multi-Tenant Workspace

> Tujuan: mengubah dashboard dari **single-tenant** (semua user melihat data yang
> sama) menjadi **SaaS multi-tenant** — setiap pelanggan punya workspace dengan
> data yang terpisah total. Desain ini mengikuti kondisi kode per September 2026.

---

## 0. Prinsip desain

1. **Tenant = workspace.** Semua data bisnis dimiliki workspace, bukan user.
   Satu workspace boleh punya beberapa user (owner + staff + demo) nantinya.
2. **Isolasi berlapis.** Filter tenant di level aplikasi (Drizzle) DAN di level
   database (RLS). Salah satu saja tidak cukup untuk SaaS berbayar.
3. **Strangler-fig, bukan big-bang.** Kolom `workspace_id` ditambahkan dulu
   (nullable), semua data existing di-backfill ke satu workspace default, lalu
   scoping diaktifkan tabel demi tabel. Aplikasi tidak pernah mati di tengah jalan.
4. **Default-deny.** Tanpa `workspace_id` pada sesi → baca kosong, tulis ditolak.
   Bukan "pakai workspace pertama" (bahaya lintas-tenant).

---

## 1. Model data

### 1.1 Tabel `workspaces` (baru — migrasi 0014)

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | "Toko Bu Sari", dst. |
| `slug` | text UNIQUE | dipakai di URL nanti (`/w/{slug}`) jika perlu |
| `plan` | text default `free` | `free` / `trial` / `pro` — hook untuk billing (Midtrans) |
| `status` | text default `active` | `active` / `suspended` (tolak login & API saat suspended) |
| `trial_ends_at` | timestamptz nullable | trial 14 hari saat register |
| `created_at` | timestamptz | |

### 1.2 `users.workspace_id` (migrasi 0014)

- Semua user existing → workspace default `websensial-demo` (data sekarang).
- Nanti: user baru selalu dibuat **bersama** workspace-nya (transaksi).

### 1.3 Kolom `workspace_id` di tabel data (fase 2 — migrasi 0015/0016)

| Tabel | Cara scoping | Catatan index |
|---|---|---|
| `stores` | kolom langsung | unique `(workspace_id, name, channel)` menggantikan unique lama |
| `suppliers` | kolom langsung | |
| `products` | **via `stores`** (join) | sudah selalu lewat storeId |
| `sales` | **via `products` → `stores`** | tidak perlu kolom sendiri |
| `settlements` | **via `stores`** | |
| `live_sessions` | **via `hosts`/`stores`** | |
| `hosts` | kolom langsung | |
| `meta_ad_tests` | kolom langsung | |
| `jobs`, `job_costs`, `job_payments` | `jobs` kolom langsung; costs/payments via jobs | |
| `invoices`, `invoice_items`, `invoice_payments` | `invoices` kolom langsung; sisanya via invoice | |
| `tasks` | kolom langsung | |
| `crm_clients` / `crm_products` / `crm_leads` | `crm_clients` kolom langsung; produk & leads via client | |
| `users` | kolom langsung (0014) | |
| `modules` | tetap global (katalog) + **`workspace_modules`** baru (toggles per workspace) | pengaturan modul jadi per-tenant |
| `_migrations`, `uploads` | global | bukan data bisnis |

Aturan praktis: **kolom `workspace_id` hanya di tabel "root"** (stores, hosts,
jobs, invoices, tasks, meta_ad_tests, crm_clients, users). Tabel anak cukup
dijamin lewat parent-nya (join/cascade) — lebih sedikit tempat salah.

### 1.4 Index

Setiap tabel root: `CREATE INDEX ... ON t (workspace_id)` — filter tenant adalah
predikat pertama di hampir semua query.

---

## 2. Dua lapis enforcement

### 2.1 Lapis aplikasi (dikerjakan di fase 3)

- `SessionUser` membawa `workspaceId` (fase 1 — sudah di sesi JWT sekarang).
- Helper baru di `src/lib/server/workspace.ts`:
  ```ts
  /** Wajib punya workspace; lempar 403 kalau tidak ada. */
  export async function requireWorkspace(): Promise<{ session; workspaceId: string }>
  /** Kondisi WHERE standar: eq(table.workspaceId, workspaceId) */
  export function tenantWhere(table, workspaceId)
  ```
- Semua query di `src/lib/server/*` dan route `/api/*` menambahkan filter
  workspace. Pola: setiap `db.select().from(t)` wajib lewat `tenantWhere`.
- INSERT: `workspaceId` diambil dari sesi, **tidak pernah dari body request**.
- UPDATE/DELETE: `where(and(eq(t.id, id), eq(t.workspaceId, ws)))` — baris
  tenant lain otomatis 404, bukan 403 (jangan bocorkan keberadaan ID).

### 2.2 Lapis database — RLS per tenant (fase 4, defense-in-depth)

Aplikasi bukan satu-satunya pintu (ada SQL editor, tool pihak ketiga). Pola:

```sql
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON stores
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
```

Setiap request API membuka transaksi dengan:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.workspace_id', ${wsId}, true)`);
  // ...query di dalam tx
});
```

`true` = hanya berlaku untuk transaksi itu (aman dengan connection pool).
Kebijakan lama dari migrasi 0010 (permissive untuk app user) diganti/diperketat.

---

## 3. Alur auth & lifecycle pelanggan (fase 5)

```
Register → verifikasi email → buat workspace (trial 14 hari) + user owner
→ set password → login
Bayar (Midtrans) → webhook → plan = pro, status = active
Trial habis & belum bayar → status = suspended → login/API menolak dengan
pesan halus ("Masa trial berakhir — silakan berlangganan")
```

- Register baru HANYA membuat workspace + user baru — tidak menyentuh tenant lain.
- Data demo per workspace: jalankan versi parameterized dari `scripts/seed.ts`
  (`--workspace <id>`) supaya tiap pelanggan baru dapat data contoh sendiri.
- Akun `demo@websensial.com` yang sekarang menempel di workspace owner akan
  dipindah menjadi pola "demo user per workspace" (invite demo per tenant).

---

## 4. Fase & status

- [x] **Fase 1 — Fondasi** (migrasi 0014): tabel `workspaces`, `users.workspace_id`
      + backfill default, `workspaceId` di sesi JWT & login. Tidak mengubah
      perilaku aplikasi.
- [ ] **Fase 2 — Skema data**: kolom `workspace_id` di 7 tabel root + unique/index
      baru + backfill + trigger/check nil tidak perlu (app-level).
- [ ] **Fase 3 — Scoping aplikasi**: `requireWorkspace()` + refactor semua query
      (dashboard, reports, POS, master, live, jobs, invoice, kanban, CRM, modules
      → `workspace_modules`). Suite test PGlite ditambah test lintas-tenant
      (user A TIDAK boleh membaca/mengubah data user B).
- [ ] **Fase 4 — RLS per tenant**: `set_config('app.workspace_id')` per request +
      kebijakan RLS ketat; uji lewat psql langsung (tanpa GUC → 0 baris).
- [ ] **Fase 5 — Register, trial & billing**: register + email verifikasi (Resend),
      provisioning workspace, plan/status/trial dijalankan, webhook Midtrans,
      rate-limit login.

## 5. Rollout & rollback

- Tiap fase = satu migrasi terpisah + satu commit. Bisa dideploy independen.
- Kolom baru selalu nullable di awal → rollback aman (cukup deploy versi lama).
- Backfill idempotent; `_migrations` mencegah eksekusi ganda.
- Setelah fase 3 stabil di produksi ≥1 minggu, kolom `workspace_id` boleh
  `SET NOT NULL`.

## 6. Checklist keamanan yang ikut ditegakkan

- [ ] Query tanpa filter workspace tidak mungkin lolos code review: semua lewat
      helper `tenantWhere` (grep audit: `db.select`, `db.insert`, `db.update`, `db.delete`).
- [ ] ID dari URL selalu divalidasi UUID + milik workspace (404 bila bukan).
- [ ] Rate-limit login & register (fase 5).
- [ ] Audit log per workspace (siapa mengubah apa) — tabel `audit_log` (opsional,
      fase 5+).
- [ ] Upload blob: path diberi prefix `workspace/{id}/...` supaya URL tidak
      saling tertukar antar tenant.
- [ ] Backup/restore per workspace harus mungkin (export SQL per tenant).
