---
"@keel/cli": minor
"@keel/scaffold": minor
"@keel/compiler": patch
"@keel/runtime-dom": patch
"@keel/check": patch
---

`keel pack [--check]` is a library's gate: it runs the steps `kind`, `package`, `check`, `test` and `ledger`, stops at the first that fails with one E1164 whose message begins with that step, and on success writes `.keel/ledger.json` (nothing under `--check`). `keel scaffold library @scope/name` writes a library that passes `keel check` and `keel test`. In a library's own folder `keel check` reads it as an app holds it installed, `keel test` writes no `.keel/` artifact, and `keel ledger` counts what an app counts over its files. `@keel/runtime-dom/jsx-runtime` gains `jsx`, `jsxs` and `Fragment`, which throw, so a library's `tsc` build imports in Node.
