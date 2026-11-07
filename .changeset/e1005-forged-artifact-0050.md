---
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": minor
---

E1005 compares `.keel/` artifacts with what the current sources compile to (rfc:0050, red-team H2). `@keel/compiler` exports `artifactHashes(files, { topology })`: the content hash of each artifact the compiler writes for the app sources among `files`, with nothing evaluated (`routes.json` is left out when a `modules/<m>/routes.ts` exists). The Vite plugin's source listing and `artifactHashes` share one predicate. `check()` compares each root `.keel/<name>.json` with `artifacts.hashes` when given, else with the hashes it derives from `files`. A forged (data changed, hash recomputed) or stale artifact is E1005, with the message `generated .keel/<name> does not match its sources; regenerate`. `keel check` derives the hashes from the whole project, so `keel check .keel` compares against every source.

One source rule (backlog 0142): `@keel/compiler` exports `isSourcePath`. `keel build`, `artifactHashes` and the Vite plugin (its source listing and the `.keel/` merge) all use it. Tests, test trees, dot dirs, build output, declarations and tool configs (`*.config.*`) are not sources, so `keel build` followed by `keel check` reports no E1005.
