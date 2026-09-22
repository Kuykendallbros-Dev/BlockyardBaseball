import { defineConfig } from 'vitest/config';

// Where the app is mounted, which the bundle needs baked in so it requests its
// own assets from the right place.
//
// The project's home is sloppycards.com/games/sloppycardsports/blockyardbaseball,
// so that build sets VITE_BASE_PATH to that path. VITE_BASE_PATH overrides
// everything, which is the single knob to turn if the mount point moves. With
// it unset the existing behaviour is unchanged: GitHub Pages still builds at
// /BlockyardBaseball/, and local dev at '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/BlockyardBaseball/' : '/'),
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
