-- Kanban tugas bebas (to-do list bisnis): kartu dibuat manual, bukan dari
-- data penjualan/job. Tiga kolom: todo -> doing -> done. Urutan dalam kolom
-- pakai `position` (nilai desimal, sisip di antara dua kartu = rata-rata).
-- Status lunas kartu "done" dicatat di completed_at. Aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "notes" text,
  -- todo | doing | done
  "status" text NOT NULL DEFAULT 'todo',
  -- low | normal | high
  "priority" text NOT NULL DEFAULT 'normal',
  "due_date" date,
  "position" numeric(14, 4) NOT NULL DEFAULT 1000,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tasks_status_position_idx" ON "tasks" ("status", "position");

-- Daftarkan modul kanban supaya menu & toggle Pengaturan mengenalinya.
INSERT INTO "modules" ("key", "label", "description", "is_enabled", "is_core", "sort_order")
VALUES ('kanban', 'Kanban', 'Papan tugas bebas: to-do, sedang dikerjakan, selesai.', true, false, 7)
ON CONFLICT ("key") DO NOTHING;
