-- Fase 5: Settlement — status pencairan dana marketplace per toko/kanal per bulan.
-- Angka dana dihitung live dari penjualan selesai (bukan disimpan), supaya
-- selalu konsisten dengan ledger. Tabel ini hanya menyimpan STATUS pencairan
-- dan nominal riil opsional dari dashboard marketplace (hybrid).
-- Aman dijalankan berulang kali di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS "settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "month" text NOT NULL,
  -- pending = dana masih tertahan di marketplace; released = sudah dicairkan.
  "status" text NOT NULL DEFAULT 'pending',
  -- Nominal riil yang benar-benar cair (opsional, dari dashboard marketplace).
  -- NULL = pakai angka perhitungan dashboard sendiri.
  "released_amount" integer,
  -- Tanggal dana benar-benar masuk (opsional).
  "released_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Satu toko cuma boleh punya satu baris settlement per bulan.
CREATE UNIQUE INDEX IF NOT EXISTS "settlements_store_month_unique"
  ON "settlements" ("store_id", "month");

CREATE INDEX IF NOT EXISTS "settlements_month_idx" ON "settlements" ("month");
