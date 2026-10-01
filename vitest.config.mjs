import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      // Modul "server-only" error di environment test (bukan React Server
      // Component). Stub kosong: cukup agar import-nya tidak meledak.
      'server-only': path.resolve(root, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // Test yang memakai Postgres in-memory butuh beberapa detik untuk start.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
