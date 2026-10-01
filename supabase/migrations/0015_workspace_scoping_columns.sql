-- Fase 2 roadmap multi-tenant (lihat roadmap-multi-tenant.md):
-- workspace_id di 8 tabel "root" — tabel yang tidak menurun lewat parent.
-- Tabel anak (products, sales, settlements, live_sessions, job_costs/payments,
-- invoice_items/payments, crm_products/leads) di-scope lewat parent-nya masing-
-- masing, jadi tidak butuh kolom sendiri.
-- Semua baris existing di-backfill ke workspace default "websensial-demo".
-- Aplikasi belum memfilter apa pun di fase ini (scoping = fase 3).
-- Aman dijalankan berulang kali (idempotent).

ALTER TABLE "stores"        ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "suppliers"     ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "hosts"         ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "jobs"          ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "invoices"      ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "tasks"         ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "meta_ad_tests" ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");
ALTER TABLE "crm_clients"   ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");

-- Backfill: semua baris lama milik workspace default.
UPDATE "stores"        SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "suppliers"     SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "hosts"         SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "jobs"          SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "invoices"      SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "tasks"         SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "meta_ad_tests" SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;
UPDATE "crm_clients"   SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo') WHERE "workspace_id" IS NULL;

-- Index filter tenant: predikat pertama di hampir semua query mulai fase 3.
CREATE INDEX IF NOT EXISTS "stores_workspace_id_idx"         ON "stores"("workspace_id");
CREATE INDEX IF NOT EXISTS "suppliers_workspace_id_idx"      ON "suppliers"("workspace_id");
CREATE INDEX IF NOT EXISTS "hosts_workspace_id_idx"          ON "hosts"("workspace_id");
CREATE INDEX IF NOT EXISTS "jobs_workspace_id_idx"           ON "jobs"("workspace_id");
CREATE INDEX IF NOT EXISTS "invoices_workspace_id_idx"       ON "invoices"("workspace_id");
CREATE INDEX IF NOT EXISTS "tasks_workspace_id_idx"          ON "tasks"("workspace_id");
CREATE INDEX IF NOT EXISTS "meta_ad_tests_workspace_id_idx"  ON "meta_ad_tests"("workspace_id");
CREATE INDEX IF NOT EXISTS "crm_clients_workspace_id_idx"    ON "crm_clients"("workspace_id");

-- Unique berpindah ke per-tenant: dua workspace boleh punya brand + kanal
-- yang sama (mis. keduanya "Sora & Soul (Shopee)").
ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_name_channel_unique";
ALTER TABLE "stores" ADD CONSTRAINT "stores_workspace_name_channel_unique"
  UNIQUE ("workspace_id", "name", "channel");

-- Nomor invoice unik per workspace, bukan global.
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_unique";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_invoice_number_unique"
  UNIQUE ("workspace_id", "invoice_number");
