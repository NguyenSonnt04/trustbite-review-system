import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Loads .env and forces NODE_ENV=test before any test imports config/app.js.
    setupFiles: ['./vitest.setup.js'],
    // DB-backed integration tests share a single Postgres; avoid parallel writes.
    fileParallelism: false,
    include: ['tests/**/*.test.js'],
  },
});
