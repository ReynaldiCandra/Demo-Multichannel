-- Fase 1 roadmap multi-tenant (lihat roadmap-multi-tenant.md):
-- 1. Tabel workspaces = tenant. Satu workspace punya banyak user; semua data
--    bisnis nantinya dimiliki workspace, bukan user.
-- 2. users.workspace_id — setiap user menempel ke satu workspace.
-- 3. Backfill: semua user existing masuk workspace default "websensial-demo"
--    (data yang sekarang ada). Aplikasi belum memfilter apa pun di fase ini,
--    jadi perilaku tidak berubah.
-- Aman dijalankan berulang kali (idempotent).

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "plan" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'active',
  "trial_ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id");

INSERT INTO "workspaces" ("name", "slug")
SELECT 'Websensial Demo', 'websensial-demo'
WHERE NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = 'websensial-demo');

UPDATE "users"
SET "workspace_id" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'websensial-demo')
WHERE "workspace_id" IS NULL;

CREATE INDEX IF NOT EXISTS "users_workspace_id_idx" ON "users"("workspace_id");
