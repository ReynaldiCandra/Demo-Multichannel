-- Status pesanan, nomor pesanan, dan persentase biaya platform per toko.
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'selesai';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "order_number" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "fee_percent" numeric(5,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_status_check" CHECK ("status" IN ('selesai', 'batal', 'retur'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "sales_order_number_idx" ON "sales" ("order_number");
