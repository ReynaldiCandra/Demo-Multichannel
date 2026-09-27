-- Fase 6: Invoice custom — dokumen bebas (bukan dari data penjualan):
-- logo, deskripsi, scope kerja, item bebas (qty bisa desimal), pembayaran
-- (DP, cicilan, pelunasan). Status lunas TIDAK disimpan: diturunkan dari
-- total pembayaran vs total tagihan. Aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_number" text NOT NULL,
  "title" text NOT NULL DEFAULT 'Invoice',
  "client_name" text NOT NULL,
  "client_address" text,
  "issuer_name" text,
  "issuer_address" text,
  "issue_date" date NOT NULL,
  "due_date" date,
  "description" text,
  "scope_text" text,
  "logo_url" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_unique"
  ON "invoices" ("invoice_number");

CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "description" text NOT NULL,
  -- Qty boleh desimal (mis. 2.5 m², 3.5 meter).
  "qty" numeric(12, 2) NOT NULL DEFAULT 1,
  "unit_price" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx"
  ON "invoice_items" ("invoice_id", "position");

CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "paid_at" date NOT NULL,
  "amount" integer NOT NULL,
  -- Bebas: "DP", "Cicilan 1", "Pelunasan", dst.
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_id_idx"
  ON "invoice_payments" ("invoice_id", "paid_at");
