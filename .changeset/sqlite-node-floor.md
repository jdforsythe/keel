---
"@keel/server": patch
"@keel/compiler": patch
"@keel/scaffold": patch
---

A `'sqlite'` deployable started on a Node older than 22.13 exits 1 with one E1560 line naming the floor and the running version, before the driver loads, instead of failing on the `node:sqlite` import. The generated entry imports the `@keel/std-db` driver when `start` first opens it, and the built `server.mjs` reads `node:sqlite` when the driver first runs.
