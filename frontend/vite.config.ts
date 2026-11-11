import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to the Spring Boot API so the browser sees one origin (no CORS).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: false, include: ['src/**/*.test.{ts,tsx}'] },
});
