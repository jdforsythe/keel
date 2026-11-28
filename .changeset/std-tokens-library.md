---
"@keel/std-tokens": minor
---

`@keel/std-tokens` carries a library manifest (`module.ts`: id `tokens`, capability `clock`) and its `@keel/*` imports as peers. Its server half lives in `*.server.ts` files, `./server` included (`src/server/index.server.ts`), and `Digested` in `src/Digested.schema.ts`, which the `./tools` entry imports so `tokens.Digested` registers in `keel check` and `keel build`.
