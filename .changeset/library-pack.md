---
"@keel/cli": minor
"@keel/scaffold": minor
"@keel/compiler": patch
"@keel/check": patch
---

`keel pack [--check]` is a library's gate: it runs the steps `kind`, `package`, `check`, `test` and `ledger`, stops at the first that fails with one E1164 whose message begins with that step, and on success writes `.keel/ledger.json` (nothing under `--check`). `keel scaffold library @scope/name` writes a library that passes `keel check` and `keel test`. In a library's own folder `keel check` reads it as an app holds it installed, `keel test` writes no `.keel/` artifact, and `keel ledger` counts what an app counts over its files. No check imports a library's entry: a library is imported only through its `./tools` export, so one without `./tools` needs no build for any app command, and a declared `./tools` that does not import is E1159.
