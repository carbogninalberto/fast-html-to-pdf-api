import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tests/api.test.js', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['app/**'],
      exclude: ['app/docs/**'],
      all: true,
      thresholds: { lines: 95 },
    },
  },
});
