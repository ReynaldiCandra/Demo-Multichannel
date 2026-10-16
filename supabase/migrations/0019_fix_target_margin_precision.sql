-- Fix: target_margin precision too small (5,2 = max 999.99)
-- Changed to (12,2) to support values up to 9999999999.99

ALTER TABLE products
ALTER COLUMN target_margin TYPE numeric(12,2);
