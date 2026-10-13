-- Foto profil user (tampil di sidebar & Pengaturan → Profil).
-- Satu kolom tanpa perubahan lain — lama tanpa foto tetap valid (NULL).
-- Aman dijalankan berulang kali (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'image_url') THEN
    ALTER TABLE "users" ADD COLUMN "image_url" text;
  END IF;
END
$$;
