---
"@keel/std-offline": minor
---

`@keel/std-offline` is a library on the format (`"keel": "library"`) with a `module.ts` manifest (`id` `offline`): its `exports` carry the `keel` condition, its `@keel/*` packages are peers, the throws the spec names sit in `unsafe/raise.ts`, `unsafe/afterRejection.ts` and `unsafe/recovering.ts`, and the declarations of `OutboxState`, `Settle` and `Resolve` are in `*.schema.ts` files. The rule reading of `@keel/std-offline/tools` no longer imports `node:path`.
