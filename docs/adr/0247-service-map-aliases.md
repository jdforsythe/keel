# ADR-0247: k.bundle: the service map and E1011 stated, and an aliased import of a module file is E1013 (RFC 0225)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** E1011 was one line in k.bundle Rules; its conformance assumed what the service map is. The scan that builds the map follows relative specifiers only, so an aliased import of a server module ends in E1011. `keel check`'s module rules (E1151, E1152, E1165) also resolve relative specifiers only, so the same alias reaches a private file of a module not in `deps` unseen. `keel check` reads no `tsconfig.json`, so a `paths` alias is already E1751.

**Decision.**
- k.bundle states the service map (own modules, `node` and `static` modules the scan reaches, placed modules with no folder; only when the topology has a `node` deployable), the scan's edges and resolution, and E1011's condition, message and scope (a `client` deployable's build in `keel build`; never `keel check` or `keel dev`).
- A file under `modules/` is imported by a relative specifier. E1013 in `keel check`, at the specifier's opening quote, with a fix to the relative path: any other specifier, resolved as the type check resolves it (package `exports` and `imports`, `node_modules`, symlinks followed, no `tsconfig.json`), that lands under `modules/`. Test files and own-module aliases included.
- The scan stays relative-only; E1011 stays the build's backstop. A build does not report E1013.

**Alternatives.**
- Mapping aliases from the resolved graph: needs Vite's resolver before the entry exists, and leaves the module rules blind; two ways to import a file.
- Teaching every resolver every alias form: reads `tsconfig.json`, R1103-critical config, for a second way.
- E1013 in the build too: the build would never reach E1011 for an alias; `keel check` is where rules land.

**Consequences.** No app in the tree changes. k.bundle reads `implemented` until its six new clauses are covered, at about 2,960 of 3,100 tokens. A module reached only through a worker file (`new URL`, `?worker`) is still unmapped by the scan.
