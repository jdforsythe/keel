---
"@keel/compiler": minor
"@keel/check": minor
---

A scoped package marked `"keel": "library"` with a root `module.ts` is a library (k.library). A `deps` entry beginning with `@` names a package: `keel check` and `keel build` import a listed library's entry and `./tools`, and those of the libraries its manifest lists; a placed library module's `./routes` and `./contract` are read as a stdlib package's; a package entry that resolves to no library is E1159. A library in `deps` is used by being listed (no E1165) and may take `std` config (E1158). E1163 reports a library manifest `deps` entry that does not begin with `@`; E1166 reports a library whose `id` an app module or another library holds. `@keel/compiler/std/libraryKind` and `@keel/compiler/std/libraryFiles` read the kind and list the app's libraries with their files.
