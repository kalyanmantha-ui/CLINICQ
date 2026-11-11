import { defineConfig } from '@playwright/test';

// Expects the API on :8080 (SEED_DEMO=true) and the Vite dev server on :5173 (see ../scripts/e2e.sh).
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
