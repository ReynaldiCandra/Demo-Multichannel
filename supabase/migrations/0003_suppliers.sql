-- Daftar suplier: nama, WhatsApp, kategori, daerah. Aman dijalankan berulang.
-- Jalankan di Supabase SQL Editor.

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
