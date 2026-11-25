---
"@keel/std-workflows": patch
"@keel/std-jobs": patch
"@keel/std-statecharts": patch
---

`@keel/std-workflows` is a library on the format (k.library): its manifest lists `observe`, its schemas live in `*.schema.ts` files, its declaration errors are thrown from `unsafe/refuse.ts`, and it reads the rule helpers of `@keel/std-jobs` and `@keel/std-statecharts` from their public `./tools` entries, which now export them; the `./tools/internal` and `./internal` entries of those two packages and the unused `./module` export of workflows are gone.
