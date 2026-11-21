---
"@keel/check": minor
"@keel/compiler": minor
---

`keel check` reports E1586 at a module id in `topology.ts` when that stdlib module's package resolves `./contract` and not `./routes`, so `keel build` fails instead of serving 404 at every path the contract declares; a runner-only package with neither export stays silent. `@keel/compiler/std/stdPlacedExports` finds the package from the app manifests' `deps` and says which of the two it resolves.
