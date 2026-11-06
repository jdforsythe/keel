---
"@keel/check": minor
"@keel/compiler": patch
---

k.module: `keel check` gains the module pass (E1151-E1157): manifests discovered at `modules/<id>/module.ts` and stdlib `node_modules/@keel/std-x/module.ts`, read statically; non-public imports, imports and `href()` outside `deps`, deps cycles, missing public names, unprefixed route/store/transaction/error ids, undeclared `ctx` capabilities, and links to non-public routes. Fixes add a dep or capability, or remove a missing public entry. `ModuleSchema` now enforces the lowerCamel `id` rule itself (parse, decode, decodeStrings, encode); `module()` relies on it.
