---
"@keel/std-workflows": patch
"@keel/std-jobs": patch
"@keel/std-statecharts": patch
"@keel/std-schedules": patch
---

`@keel/std-workflows` is a library on the format (k.library): its manifest lists `observe`, its schemas live in `*.schema.ts` files, its declaration errors are thrown from `unsafe/refuse.ts`, and its entry is server-only (`src/index.server.ts`), as its whole API is. `@keel/std-jobs/tools` exports `keyFindings`, `runnersEdits` and `runnersFindings`, and `@keel/std-statecharts/tools` exports `chartCalls` and `literalShape`, the readers the rules of std-workflows and std-schedules build on; their `./tools/internal` and `./internal` entries and the unused `./module` export of workflows are gone.
