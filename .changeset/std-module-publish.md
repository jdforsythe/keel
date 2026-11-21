---
"@keel/compiler": patch
"@keel/std-channels": patch
"@keel/std-health": patch
"@keel/std-jobs": patch
"@keel/std-schedules": patch
"@keel/std-sessions": patch
"@keel/std-workflows": patch
---

A stdlib package's module manifest is found through its `./module` export, so an installed package serves its routes: the six stdlib module packages build `module.ts` into `dist` and publish their exports from `dist`.
