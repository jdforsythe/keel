---
"@keel/std-postgres": minor
---

`@keel/std-postgres` is a library on the format (`"keel": "library"`): its `exports` carry the `keel` condition, its `@keel/*` packages are peers, and `module.ts` names the `clock` capability `database` reads. The `./server` and `./testing` entries are server-only (`src/server/index.server.ts`, `src/testing/index.server.ts`), as is every file under `src/server/` that holds a value; the root entry stays client-safe (`sql`, `fragment`, `NoRows`, declared in `NoRows.schema.ts`). The throws the spec names (E2453 to E2457, E2460) and a driver error passed on unchanged go through `unsafe/raise.ts`; a catch that reads the driver's error object goes through `unsafe/settle.ts`, and every other catch is `attempt`. The `./module` export is removed; `module.ts` is read from the package folder.
