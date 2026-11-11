---
"@keel/compiler": minor
---

The Vite plugin bundles a `node` deployable's generated production entry (`virtual:keel/server`) into `dist/<name>/server.mjs` with every dependency, beside `routes.json`, the route table of every module in the app (so a deployable forwards its peers' paths), and a copy of `.keel/std.json`. The dev server serves every `node` deployable's dev app from one origin (`virtual:keel/dev`), the others as in-process peers. `pathCollisions` reports E1559 for one path in two deployables.
