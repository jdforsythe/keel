---
"@keel/compiler": patch
---

A `node` deployable's server build that bundles PGlite (`@keel/std-postgres`, `pglite:` mode) writes PGlite's `initdb.wasm`, `pglite.data` and `pglite.wasm` beside `server.mjs`, where the bundle reads them.
