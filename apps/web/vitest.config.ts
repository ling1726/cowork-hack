import { defineConfig } from 'vitest/config';

// The web app is covered by Playwright (e2e/). Keep Vitest away from those specs.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
