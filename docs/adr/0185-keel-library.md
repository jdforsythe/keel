# ADR-0185: a Keel library: a package kind checked again by the app (RFC 0163)

**Status:** accepted (operator, 2026-11-25). Not built: the build comes before the public release, before k.parity's second part.

**Context.** The compiler does not transform `node_modules` or linked packages, and `keel check` does not read them, so a published Keel component reaches an app unchecked, uncompiled and uncounted. The kernel tells a stdlib package by its `@keel/std-*` name. D49 asks for one blessed way to publish Keel code with the guarantees built in, and k.parity asks that the stdlib hold no power such a package lacks.

**Decision.**
- A library is a scoped package marked `"keel": "library"` with a root k.module manifest. It ships its source for the app's compiler (a `keel` export condition) and its build for what Node imports at check time.
- An app lists it in `deps`; an entry beginning with `@` names a package.
- The app's compiler and `keel check` read a library file `<f>` as `modules/<id>/<f>`: every rule runs, no `node_modules/` exclusion applies, diagnostics carry no fix.
- Library elements take non-literal ids from an `id` prop (E1161). A library reaches only itself and other libraries (E1163), and its `id` is unique in the app (E1166).
- The library ships its own ledger file. The app recounts `unsafe` and `hostElements`, compares them for an installed library (E1162), shows the library's items without counting them, and records `libraries` in its ledger.
- `keel pack` is the publish gate (E1164); `keel scaffold library` writes a library that passes it.
- The stdlib packages are libraries, read by kind; three named closed sets remain (k.parity). App data stays a seam: what the kernel gives `@keel/std-postgres` by name, any package gets through a manifest's `env`, the build's copy of files a bundled package reads, and registration through a library (k.server-deps).

**Alternatives.**
- Built JS with a signed claim: the app would trust it, and it could not match the app's tokens.
- Source only: Node does not strip types under `node_modules`.
- A separate `keel-library.json` and a token list in the manifest: second statements of the ledger file and the source.
- Counting library rungs: claims without evidence.

**Consequences.**
- Sharing Keel code means publishing a package the app checks in full, at a compile cost per app build.
- Adopting or upgrading a library is a ledger change a reviewer sees.
- The stdlib's own code is held to app rules; the work of slice 4 fixes what that reading reports.
