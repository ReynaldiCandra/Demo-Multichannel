-- Nama tampilan default akun owner: "Reynaldi Bgskr".
-- Nama ini muncul di ikon profil (sidebar & topbar) saat memperkenalkan
-- dashboard sebagai demo. Hanya menyentuh akun owner; akun demo tidak diubah.
-- Aman dijalankan berulang (idempotent — hasilnya selalu sama).

UPDATE "users" SET "name" = 'Reynaldi Bgskr' WHERE "role" = 'owner';
