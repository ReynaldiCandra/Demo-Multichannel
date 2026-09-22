-- Foto supplier dan bukti transaksi penjualan.
-- File gambar disimpan di Vercel Blob; database hanya menyimpan URL-nya.

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "image_url" text;