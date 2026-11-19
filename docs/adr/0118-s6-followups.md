# ADR-0118: throw frames in the log, shipped sink rungs, E1558 for server state, a per-source CSP cap, E1004's reach, kernel-only entries under `internal` (RFC 0095)

**Status:** accepted

**Context.** S6 left six gaps. A `keel.unexpected` diag has no frames although k.server Log asks for them, because the server catches through `attempt`, which drops the stack. `pii.json` reads its sink rungs from the project's own ledger, so an app outside the repo gets `coverage` 0. A `client` deployable's route naming `stores` passes `renderRoute` and fails only in the browser; E1558 covers live loaders, at `createApp` only. One CSP report window serves the whole process, so one client can turn every other report into `dropped`. k.compiler is at 1,500 tokens and cannot state that E1004 covers re-exports and literal `import()`. `@keel/server/dom`, `@keel/server/start` and `@keel/compiler/entry/*` are kernel-only entries without an `internal` segment, outside E1576.

**Decision.**
- D1: a throw's json `diag` gains `frames`, its first 5 stack positions in app code (outside `packages/`, `node_modules/` and `.keel/`), each `<path>:<line>:<col>` relative to the working directory, scrubbed with the request's `piiValues`. The server catches with an internal `caught`; `attempt` and the `keel.unexpected` KeelError are unchanged.
- D2: `@keel/cli` ships the kernel ledger's rungs for the four sink clauses as generated source (`tooling/generate.mjs`, drift-checked by `--check`); `pii.json` uses the project ledger's rung when it holds the item, else the shipped one. Stated in k.evidence.
- D3: E1558 moves to k.topology: a live loader, or a `loader` or `action` naming `stores`, in a `*.server.ts` of a module a `client` or `static` deployable serves; `serverOnlyCalls` in `@keel/compiler` reports it at the call in `keel check` and `keel build`, and `createApp` throws it. `keel explain E1558` gets a row.
- D4: the CSP window keeps its 100 and caps one source at 10; the source is the last `x-forwarded-for` entry, else the peer address, held in memory for the window and never logged; a report with no source counts toward the 100 only.
- D5: k.compiler drops two sentences its Conformance clauses already state, rewords E1004 to name value imports, re-exports and literal `import()`, and adds one clause (1,500 to 1,498 tokens). No header changes section id. The `k.artifacts` split is the next seam.
- D6: the three entries become `@keel/server/internal/dom`, `@keel/server/internal/start` and `@keel/compiler/internal/entry/*`; E1576 covers them with no rule change.
- Budgets: `@keel/compiler` to 29.25kb, `@keel/cli` to 24.25kb, `@keel/server/internal/dom` measured for the first time at 4.75kb; `@keel/check` fits.

**Alternatives.**
- The stack in `keel.unexpected` `data`, rejected: the KeelError reaches results, the browser and sessions.
- A second catch API in `@keel/schema/internal`, rejected: adds to a browser package for one server need.
- Rungs from a file the project names, rejected: the app could claim any rung.
- E1558 in `@keel/check` only, rejected: `keel build` would still pass.
- A new code beside E1558, rejected: one code for server-only work in a deployable without a server.
- Keying CSP reports by caller cookie, or deduping by content, rejected: the path has no caller and beacons send no cookie; content is attacker-chosen.
- A trusted-proxy option, rejected for now: a new `createApp` field.
- Splitting k.compiler now, rejected: 6 header changes against 0.
- Naming the entries in E1576, rejected: grows a list in k.security and `@keel/check` with each new seam.

**Consequences.**
- Throw diags locate the failing app line in dev and test; production frames point into `server.mjs` until source maps are on (open question).
- Evidence bundles of apps outside the repo report the kernel's sink rungs; a ledger re-commit that changes one fails `generate --check` until regenerated.
- A `client` or `static` module's server state fails `keel check` and `keel build` before it reaches a browser.
- One CSP source takes at most 10 of a window's 100; a forged `x-forwarded-for` returns to today's shared cap at worst.
- k.compiler has 2 tokens left; its next addition needs the split.
- Apps outside the repo that imported the renamed entries fail resolution; the new paths are E1576.
