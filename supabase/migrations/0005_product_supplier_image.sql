-- Relasi supplier-produk dan URL foto produk.
-- File gambar disimpan di Vercel Blob; database hanya menyimpan URL-nya.
-- Aman dijalankan berulang kali di Supabase SQL Editor.

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

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" text;

DO $$ BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_supplier_id_suppliers_id_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "products_supplier_id_idx" ON "products" ("supplier_id");