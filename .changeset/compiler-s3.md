---
"@keel/compiler": minor
---

The Vite plugin bundles a `node` deployable's generated production entry (`virtual:keel/server`) into `dist/<name>/server.mjs` with every dependency, beside copies of `.keel/routes.json` and `.keel/std.json`. The dev server serves every `node` deployable's dev app from one origin (`virtual:keel/dev`), the others as in-process peers. `pathCollisions` reports E1559 for one path in two deployables.
