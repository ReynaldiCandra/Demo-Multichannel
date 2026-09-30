-- Revisi analisa toko + live selling:
-- 1. Logo/foto untuk toko & kanal (SaaS: tiap user punya brand sendiri).
-- 2. Foto host (wajah tim host, tampil di kartu sesi).
-- 3. Total komentar per sesi live (metrik engagement).
-- Aman dijalankan berulang kali (idempotent).

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "total_comments" integer NOT NULL DEFAULT 0;
