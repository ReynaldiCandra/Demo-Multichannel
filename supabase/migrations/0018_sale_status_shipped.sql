-- Status baru: pesanan sudah dikirim ke pembeli tetapi dana belum pasti masuk,
-- jadi tetap dikecualikan dari omzet & profit (senada batal & retur).
-- Melonggarkan CHECK constraint dari 0002. Aman dijalankan berulang.
-- Jalankan di Supabase SQL Editor.

ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_status_check";

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_status_check" CHECK ("status" IN ('selesai', 'batal', 'retur', 'sedang_dikirim'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
