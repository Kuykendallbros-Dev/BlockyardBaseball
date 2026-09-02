# Blockyard Baseball

A web-first, blocky-styled baseball game. Arcade-simple to pick up, with a
live-service meta layer planned on top. This repo holds the game code; design and
planning live in the Winslow repo under `blockyard-baseball/`.

## Status

**Phase 0 — Feel the swing.** Current build is the scaffold: a single Three.js
scene with a blocky ground plane and a cube "batter" under an orbit camera.

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Three.js](https://threejs.org/) for rendering
- [Vitest](https://vitest.dev/) for tests, ESLint for linting
- Deployed to GitHub Pages from `main` via GitHub Actions

## Develop

```bash
npm install
npm run dev        # local dev server
npm run lint
npm test
npm run build      # production build to dist/
npm run preview    # serve the production build
```

## Deploy

Every push to `main` runs lint, tests, and a production build, then publishes
`dist/` to GitHub Pages. The live URL is
`https://kuykendallbros-dev.github.io/BlockyardBaseball/`.

The Vite `base` path is switched to `/BlockyardBaseball/` only when building in
GitHub Actions, so local dev and preview stay at `/`.
