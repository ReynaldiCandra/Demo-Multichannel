-- Logo kanal marketplace hasil upload owner (sama seperti logo toko, tapi
-- per NAMA KANAL, contoh: "TikTok Shop", "Shopee", "Lazada"). ChannelAvatar
-- memprioritaskan logo ini di atas SVG simple-icons supaya kanal tanpa ikon
-- resmi (Lazada, Tokopedia, dll) tetap tampil berlogo di semua halaman.
-- Aman dijalankan berulang kali (idempotent).

CREATE TABLE IF NOT EXISTS "channel_logos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Tenant pemilik logo (multi-tenant — lihat roadmap-multi-tenant.md).
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  -- Nama kanal apa adanya ("TikTok Shop") untuk tampilan di Pengaturan.
  "channel" text NOT NULL,
  -- Versi lowercase-trim dari `channel`; menjadi kunci unik pencocokan
  -- case-insensitive di klien.
  "channel_key" text NOT NULL,
  -- URL logo di Vercel Blob (hasil /api/uploads/image kind=channel-logo).
  "logo_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Nama constraint disamakan dengan schema Drizzle (stores style) supaya
-- `db:push` tidak menganggapnya berbeda.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channel_logos_workspace_channel_unique') THEN
    ALTER TABLE "channel_logos"
      ADD CONSTRAINT "channel_logos_workspace_channel_unique"
      UNIQUE ("workspace_id", "channel_key");
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "channel_logos_workspace_id_idx"
  ON "channel_logos" ("workspace_id");

-- Selaraskan RLS dengan 0010: aplikasi jalan via role owner (bypass),
-- anon/Data API Supabase tidak bisa membaca tanpa policy. Idempotent.
ALTER TABLE "channel_logos" ENABLE ROW LEVEL SECURITY;
