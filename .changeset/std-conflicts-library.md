---
"@keel/std-conflicts": minor
---

`@keel/std-conflicts` is a library on the format (`"keel": "library"`) with a `module.ts` manifest (`id` `conflicts`): its `exports` carry the `keel` condition, its `@keel/*` packages are peers, the throws of a stores factory that does not match the snapshot sit in `unsafe/raise.ts`, and `RaceRecord` and `RefRecord` are declared in `*.schema.ts` files.
