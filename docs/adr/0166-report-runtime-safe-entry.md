# ADR-0166: a runtime-safe entry for std-report, and `keel report` (RFC 0144)

**Status:** proposed (for the orchestrator to accept).

**Context.** `@keel/std-report` registers its `report.tally` formatter from the main entry, which imports `@keel/cli`. `keel build` follows that import into vite and vitest and fails, so a deployable cannot import `Tally` or `tallyOf`. The formatter also has no app-facing consumer: `respond` is test-only, `stdCommand` reserves `session` alone, and the server log writes fixed kinds. Other std packages keep CLI-time code behind a `./tools` export that `keel` loads from a module's `deps` (k.module).

**Decision.**
- C1: `@keel/std-report` exports `Tally` and `tallyOf` only, imports `@keel/schema` alone and registers nothing.
- C2: `@keel/std-report/tools` (no exports) registers the `report.tally` formatter and the `report` command; `keel check`, `keel build` and `keel report` load it through `deps`.
- C3: an app serves a tally as an inspector section with schema `Tally`; `keel report [url]` reads the dev app's inspect document and emits each tally section as a `report.tally` record, by section id, then `ok report <n> tallies`.
- C4: `stdCommand` reserves `report` beside `session`, under the same rules (I1055 unfilled, E1053 twice).
- C5: no new code: E1056 for a bad target, as `keel inspect`.
- C6: a lint over every std main entry is a backlog line, not part of this unit.
- C7: k.cli keeps its status; std.report is `implemented` until its conformance lands.

**Alternatives.** Rendering registered kinds inside `keel inspect` (a kernel command changes for one std package, and it would import std `deps`). A `report.tally` server log record (the log's kinds are fixed, and rendering it at runtime needs the formatter in the server). Exporting `respond` to apps (the CLI as a runtime dependency). A dynamic `import('@keel/cli')` on the main entry (the bundler still follows it). A general entry rule now (red on std-conflicts, std-brands and std-sessions).

**Consequences.**
- Server and browser code import `@keel/std-report`; a conformance test bundles the entry for a browser and allows inputs from the package and `@keel/schema` only.
- Code that relied on the main entry registering the kind adds `import '@keel/std-report/tools'`: the package's conformance and tests.
- Tallies reach a person from a dev app only; a built server has no reader (RFC 0144 Known limits).
- The kernel's reserved std command names are two; a third is another RFC.
- std-conflicts, std-brands and std-sessions still have main entries that reach `@keel/cli` or `@keel/check`.
