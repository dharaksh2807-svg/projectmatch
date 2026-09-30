import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    exclude: ['tests/**', 'node_modules/**', 'e2e/**'], // Exclude Playwright E2E tests
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
