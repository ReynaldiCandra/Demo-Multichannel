-- CRM Leads (Fase CRM): kelola calon pembeli hasil iklan / outreach.
-- Struktur: client (pemilik kampanye) → produk iklan → leads (orang).
-- Kategori lead = pipeline: hot | warm | closing | follow_up.
-- `source` bebas: meta, google, shopee_ads, tiktok_ads, organik, lainnya.
-- Aman dijalankan berulang kali (idempotent).

CREATE TABLE IF NOT EXISTS "crm_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  -- Bebas: dropshipper, konveksi, kafe, freelancer, dst.
  "category" text,
  "contact_name" text,
  "phone" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "crm_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "crm_clients"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  -- Harga jual untuk referensi saat closing (opsional).
  "price" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "crm_products_client_id_idx"
  ON "crm_products" ("client_id");

CREATE TABLE IF NOT EXISTS "crm_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "crm_clients"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "crm_products"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "phone" text,
  -- Daerah asal lead (kota/kecamatan, bebas).
  "region" text,
  -- meta | google | shopee_ads | tiktok_ads | organik | lainnya (bebas).
  "source" text NOT NULL DEFAULT 'meta',
  -- hot | warm | closing | follow_up
  "category" text NOT NULL DEFAULT 'follow_up',
  "notes" text,
  -- Tanggal follow-up berikutnya; NULL = tidak dijadwalkan.
  "follow_up_at" date,
  -- Terisi saat kategori berubah menjadi closing.
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "crm_leads_client_id_idx" ON "crm_leads" ("client_id");
CREATE INDEX IF NOT EXISTS "crm_leads_category_idx" ON "crm_leads" ("category");
CREATE INDEX IF NOT EXISTS "crm_leads_follow_up_idx" ON "crm_leads" ("follow_up_at");

-- Daftarkan modul crm supaya menu & toggle Pengaturan mengenalinya.
INSERT INTO "modules" ("key", "label", "description", "is_enabled", "is_core", "sort_order")
VALUES ('crm', 'CRM Leads', 'Kelola calon pembeli per klien & produk: hot, warm, closing, follow-up.', true, false, 8)
ON CONFLICT ("key") DO NOTHING;

-- Selaraskan RLS dengan 0010: aplikasi jalan via role owner (bypass),
-- Data API/anon key Supabase tidak bisa membaca tanpa policy.
ALTER TABLE "crm_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_leads" ENABLE ROW LEVEL SECURITY;
