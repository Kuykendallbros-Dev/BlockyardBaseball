import { defineConfig } from 'vitest/config';

// GitHub Pages serves this project at /BlockyardBaseball/, so assets must be
// requested from that base path. For local dev the base is '/'.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/BlockyardBaseball/' : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
