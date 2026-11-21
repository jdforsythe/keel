# ADR-0185: a Keel library: a package kind checked again by the app (RFC 0163)

**Status:** proposed (orchestrator, for the operator to confirm before the freeze flip). The build comes after the first real apps.

**Context.** Today the compiler does not transform `node_modules` or linked packages, and `keel check` does not read them. A published Keel component therefore reaches an app unchecked, uncompiled and uncounted. D49 asks for a blessed way to publish components with the guarantees built in.

**Decision.**
- A library is a package marked `"keel": "library"`. It ships source, a k.module manifest naming its tokens, a `keel-library.json` that `keel pack` writes (surface, tokens, `unsafe` and `hostElements` counts, ledger items, docs), and packed docs.
- The app's compiler and `keel check` treat its source as app code. Every rule runs, and the counts are recomputed (E1162).
- Library elements take explicit ids from an `id` prop (E1161).
- The app's ledger shows the library's rungs without counting them, and adds its `unsafe` and `hostElements` counts.
- `keel scaffold library` creates one. `keel pack` is the publish check and refuses a library that fails its own gate (E1164).
- The stdlib uses the format.

**Alternatives.**
- Built JS with a signed claim: the app would trust it, and it could not match the app's tokens.
- A separate manifest file: a second shape for k.module's.
- Counting library rungs: claims without evidence.
- A registry or a signing service: out of scope.

**Consequences.**
- Sharing a component means publishing a package that the app checks in full, at a compile cost per app build.
- Stdlib imports of kernel `internal` entries must become public seams or a named exception (RFC 0163, For the operator).
