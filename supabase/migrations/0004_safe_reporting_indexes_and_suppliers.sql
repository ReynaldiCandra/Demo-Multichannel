-- Hardening untuk deployment yang hanya menjalankan migration lama.
-- Aman dijalankan berulang di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "whatsapp" text,
  "category" text,
  "city" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;

-- Backstop untuk database yang berhenti setelah migration awal.
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'selesai';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "order_number" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "fee_percent" numeric(5,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "stores_channel_active_idx"
  ON "stores" ("channel", "is_active");
CREATE INDEX IF NOT EXISTS "products_store_active_idx"
  ON "products" ("store_id", "is_active");
CREATE INDEX IF NOT EXISTS "sales_status_sale_date_idx"
  ON "sales" ("status", "sale_date");
CREATE INDEX IF NOT EXISTS "sales_product_status_date_idx"
  ON "sales" ("product_id", "status", "sale_date");