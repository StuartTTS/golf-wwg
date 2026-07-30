import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests for pure logic in packages/*. App e2e uses Playwright separately.
    include: ['packages/**/src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
