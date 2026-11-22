---
"@keel/check": minor
"@keel/server": minor
"@keel/store": minor
"@keel/cli": minor
---

E1550: a layout's loader and a loader under it whose different `stores` factories create one store id. `keel check` reports it at the deeper loader's `stores` value, reading each factory statically (a top-level function or `const`, or an import of one, and the functions it calls); `keel build` and `createApp` run each factory once on a sim ctx and refuse it. Two loaders naming one factory share its store. `@keel/store/internal` exports `storeIdClashes`.
