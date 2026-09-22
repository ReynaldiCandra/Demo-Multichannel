-- Index tambahan untuk laporan penjualan per toko / produk.
-- Aman dijalankan berulang (IF NOT EXISTS). Jalankan di Supabase SQL Editor.
CREATE INDEX IF NOT EXISTS "sales_sale_date_product_idx" ON "sales" ("sale_date", "product_id");
