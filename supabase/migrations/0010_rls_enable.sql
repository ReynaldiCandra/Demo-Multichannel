-- Row Level Security untuk seluruh tabel (defense-in-depth Supabase).
-- Aplikasi tetap berjalan normal: koneksi memakai role owner (bypass RLS
-- tanpa FORCE), sedangkan Data API/anon key Supabase tidak lagi bisa
-- membaca tabel apa pun tanpa policy. Statement ini idempotent — menjalankan
-- ulang tidak error.

ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hosts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_ad_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
