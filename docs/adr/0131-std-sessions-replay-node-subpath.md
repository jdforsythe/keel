# ADR-0131: `replay` on the node subpath of `@keel/std-sessions` (RFC 0108)

**Status:** accepted (user for the decisions, orchestrator for the choices, 2026-11-17).

**Context.** The root entry of `@keel/std-sessions` is the browser entry (`record`), held to `7.5kb`. It re-exported `replay`, which imports `renderRoute` from `@keel/testing` and through it axe-core. The budget bundles with every package external, so it never saw the import; only tree-shaking kept the test harness out of a client bundle. `replay` already had its own subpath, `./replay`.

**Decision.**
- D1: `replay` is exported from `@keel/std-sessions/replay` only; the root keeps its browser and schema exports and the `ReplayResult` type.
- D2: `@keel/testing` is an optional peer of `@keel/std-sessions` (and a dev dependency for its tests); only the node subpaths load it.
- D3: golden-1 lists `@keel/testing` and `@keel/std-conflicts` under `devDependencies`.
- D4: std.sessions names the subpath and states the root imports no `@keel/testing`; a conformance case bundles the root and checks it.

**Alternatives.**
- Side-effect hints so bundlers drop `replay`: one mistaken import still ships the harness.
- A `./node` subpath for all node tools: a second path to each.
- `@keel/testing` as a dev dependency only: consumers of the node subpaths could not resolve it.

**Consequences.**
- A browser bundle cannot reach `@keel/testing` through `@keel/std-sessions`.
- Callers import `replay` from `@keel/std-sessions/replay`; a project that runs the node subpaths lists `@keel/testing`, as scaffolded projects do.
