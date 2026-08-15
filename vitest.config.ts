import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    passWithNoTests: true,
  },
});
