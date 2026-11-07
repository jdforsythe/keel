---
"@keel/compiler": minor
"@keel/server": minor
"@keel/cli": minor
"@keel/check": patch
---

RFC 0048: `keel build` runs Vite once more per `node` deployable (`KEEL_DEPLOYABLE=<name>`); the plugin then builds the resume entry and its islands into `dist/<name>/` (hashed `assets/`, `.vite/manifest.json`, `@keel/compiler/entry/CLIENT_MANIFEST`) and writes no `.keel/`. `createApp({ assets: 'dist/<name>' })` in production reads that manifest at startup (missing or entry-less: E1555), points island documents at the built entry and serves `/assets/*` with `cache-control: public, max-age=31536000, immutable`; dev, or no `assets`, keeps serving `/@keel/entry.ts`. `keel explain E1555`.
