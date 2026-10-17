-- Kalkulator Profit Marketplace (roadmap kalkulator):
-- 1) Target profit per produk — dua mode: per pcs (produk normal) dan per
--    batch qty (produk yang mengandalkan volume). NULL = pakai default global
--    workspace (profit_settings.default_target_profit_pcs).
-- 2) Mode per produk menentukan kalkulator mana yang dipakai untuk warning.
-- 3) profit_settings per workspace: default target (Rp50.000) + margin
--    keamanan (%) — buffer fluktuasi harga yang ikut melebarkan harga minimum.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "target_profit_pcs" integer,
  ADD COLUMN IF NOT EXISTS "target_profit_batch" integer,
  ADD COLUMN IF NOT EXISTS "target_profit_batch_qty" integer,
  ADD COLUMN IF NOT EXISTS "profit_mode" text NOT NULL DEFAULT 'per_pcs';

CREATE TABLE IF NOT EXISTS "profit_settings" (
  "workspace_id" uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "default_target_profit_pcs" integer NOT NULL DEFAULT 50000,
  "safety_margin_percent" numeric(5, 2) NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
