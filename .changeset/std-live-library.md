---
"@keel/std-live": minor
---

`@keel/std-live` is a library on the format (`"keel": "library"`) with a `module.ts` manifest: its `exports` carry the `keel` condition, its `@keel/*` packages are peers, and the E1203 throw of `live` called outside a scope sits in `unsafe/outsideScope.ts`.
