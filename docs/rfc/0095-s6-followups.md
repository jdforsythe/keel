# RFC 0095: S6 follow-ups (throw frames in the log, shipped sink rungs, E1558 for server state, a fair CSP window, E1004's reach, kernel-only entries)

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 3, 4, 6; open questions answered as recommended; the user confirms or reverses, tasks/0312-s6-compliance/PLAN.md D24). For backlog 0543, 0544, 0548, 0557, 0558, 0565. Each decision cites the WORKFLOW RFC default it applies; the points the defaults leave open are under Questions with a recommendation. ADR-0118 records it.

## Decisions
- D1 (0543): a throw's `diag` record gains `frames`, the first 5 stack positions in app code (E1576's definition: outside `packages/`, `node_modules/` and `.keel/`), each `<path>:<line>:<col>` relative to the working directory, scrubbed with the request's `piiValues` like the message. The server keeps the thrown value itself; `attempt` and the `keel.unexpected` KeelError stay as they are (defaults 4, 2).
- D2 (0544): `@keel/cli` ships the kernel ledger's rungs for the four sink clauses as generated source (`packages/cli/src/internal/KERNEL_SINK_RUNGS.ts`, written by `tooling/generate.mjs` from `tooling/ledger/ledger.json`, drift-checked by `--check`). `pii.json` reads a clause's rung from the project ledger when it holds that item, else from the shipped table. k.evidence says so; k.privacy is unchanged (defaults 3, 6).
- D3 (0548): E1558 moves to k.topology and widens to "a live loader, or a `loader` or `action` naming `stores`, in a `*.server.ts` of a module a `client` or `static` deployable serves", reported at the call by `keel check` and `keel build` (new `serverOnlyCalls` in `@keel/compiler`, beside `pathCollisions`) and thrown by `createApp` (defaults 6, 3, 5).
- D4 (0557): the CSP window keeps its global 100 and adds a cap of 10 per source, the last `x-forwarded-for` entry, else the peer address; a report with no source counts toward the 100 only. Sources live in memory for the window and are never logged (defaults 4, 6).
- D5 (0558): tighten k.compiler, no split. Two sentences that repeat a Conformance clause leave the prose; E1004 names value imports, re-exports and literal `import()`; one clause is added. k.compiler goes from 1,500 to 1,498 tokens and no conformance header changes section id.
- D6 (0565): rename the kernel-only entries under an `internal` segment: `@keel/server/dom` to `@keel/server/internal/dom`, `@keel/compiler/entry/*` to `@keel/compiler/internal/entry/*`, and `@keel/server/start` to `@keel/server/internal/start`. E1576 then covers them with no rule change (defaults 6, 2).

New codes: none. E1558 is widened and rehomed.

## Problem
Measured on `jdforsythe/test-impl` at `bcba4bf`.

- **0543.** k.server Log asks for "app frames only, max 5" on a `diag` for an uncaught throw (`spec/kernel/k.server.md:23`); no record has frames. The server runs loaders, actions and runners through `attempt` (`packages/server/src/internal/runLoaders.ts:19`, `runAction.ts`, `keepRunning.ts:19`, `createApp.ts:194`), and `attempt` maps a throw through `toUnexpected` (`packages/schema/src/internal/toUnexpected.ts:15-17`) to `{ code, message, data: { cause } }`, `cause` being `"Name: message"`; the stack is dropped there. The `Diag` type is `{ code, message }` (`packages/server/src/internal/Diag.ts:2`), written by `diagLine.ts:5-9`. No stack filter exists in any package. The scrub is `scrubbed(message, values)` (`packages/server/src/internal/scrubbed.ts:13-22`), which replaces each of the request's `piiValues` (`rq.pii`, filled by `notePii.ts:4-7`) in any string, plain, URI-encoded, JSON-escaped and base64. No conformance test covers frames.
- **0544.** `bundleWrite` builds the rung map from the project's own ledger run (`packages/cli/src/internal/bundleWrite.ts:88-90`) and passes `rungs.get(clause) ?? "none"` to `piiReport` (`:107`). The sink clauses are fixed in `PII_SINKS.ts:5-10` (`std.sessions#2`, `k.privacy#7`, `k.privacy#6`, `k.evidence#5`). A project outside this repo has no `spec/` and no kernel conformance, so its ledger holds none of those items, every sink is `none`, and `coverage` (`piiReport.ts:51-52`) is 0 whenever the app has a `.pii()` path. The kernel ledger has all four at `probabilistic` (`tooling/ledger/ledger.json:9749`, `:10057`, `:10061`, `:11269`). `@keel/cli` publishes `dist` only (`packages/cli/package.json`, `"files": ["dist"]`), built by `tsc`, so shipped data must be source. `tooling/generate.mjs:88-110` already writes committed files from sources with a `--check` drift mode (S0007).
- **0548.** E1558 today: "a live loader a non-`node` deployable serves" (`spec/kernel/k.server.md:25`), thrown only by `createApp` (`packages/server/src/internal/selectDeployable.ts:37-42`). Since RFC 0093, `renderRoute` runs a route's `stores` in a test, while a client router refuses them at run time with `keel.unexpected` and no E code (`packages/router/src/internal/runLoaders.ts:20`, `createRouterWith.ts:288`, message `STORES_SERVER_ONLY`). Nothing checks either before run time. No check or compiler code reads `*.server.ts` calls or detects `async function*`; `routeLiterals` reads `routes.ts` only (`packages/compiler/src/types/RouteLiteral.ts`). `keel check` and `keel build` both call `pathCollisions` (`packages/cli/src/internal/checkCommand.ts:26`, `buildCommand.ts:41`), the shape this rule reuses. In the repo, `stores:` and the one live loader are only in modules `node` deployables serve (golden-1 `api` and `digest`, golden-2 `kitchen`).
- **0557.** One window per process: `sv.reports` (`packages/server/src/createApp.ts:163`, type `ReportWindow.ts:5`), cap 100 per 60 s (`cspReport.ts:12-13`, `:44-58`). A client sending 100 reports a minute makes every other report `dropped`. The CSP path runs before `routed()` (`createApp.ts:205`), so no caller exists there, and Reporting API beacons carry no cookie in any case. The server reads no client address today; only `x-forwarded-proto` (`httpsOf.ts`). No rate limiter or bounded map exists in `packages/server/src`.
- **0558.** k.compiler is 1,500 of 1,500 tokens. E1004 reads "imported from client-reachable code" (`spec/kernel/k.compiler.md:18`), while the rule also reports a re-export and a literal `import()`, type-only forms excepted (`packages/compiler/test/serverImport.test.ts:10-16`). Of 25 `// Spec: k.compiler` header lines in 24 conformance files, 20 quote Conformance clauses, 4 cite Rules (E1000, E1002, E1049) and 1 Build-time evaluation; none cites API, Output, Escaping by context or Artifacts.
- **0565.** RFC 0094's E1576 matches an `internal` path segment. Three kernel-only entries have none:
  - `@keel/server/dom` (`packages/server/package.json:15-18`, `./src/internal/dom/installServerDom.ts`). Named as a string in `packages/compiler/src/internal/serverEntryCode.ts:6` and `:20`, and `devEntryCode.ts:8`. Budget key `tooling/budgets.json:39` (`2kb`), which measures nothing: `budgets.mjs` looks for `packages/server/src/dom/index.ts` or `src/dom.ts`, neither exists, and it skips the entry without a word. The file bundles to 4,623 B gzip.
  - `@keel/compiler/entry/*` (`packages/compiler/package.json:27-30`, `./src/entry/*.ts`). Imported by `packages/server/src/createApp.ts:1` (`ENTRY_PATH`), `packages/server/src/internal/servedEntry.ts:1-2` (`ENTRY_PATH`, `resumeEntry`), `packages/server/src/internal/loadAssets.ts:1` (`CLIENT_MANIFEST`) and `packages/compiler/test/clientBuild.test.ts:6-7`. Inside the compiler the same files are imported by relative path.
  - `@keel/server/start` (`packages/server/package.json:11-14`, `./src/start.ts`). Named as a string in `serverEntryCode.ts:7`; its doc comment says only the generated entry calls it (`packages/server/src/start.ts:17`). Budget key `tooling/budgets.json:40`.
  The generated entries are virtual modules (`virtual:keel/server`, `virtual:keel/dev`, served from `packages/compiler/src/vite.ts:445-447`), never app files, so E1576 never sees these specifiers in the kernel's own use. No app, eval, scaffold template or conformance file imports any of the three. Docs naming them: `packages/server/README.md:7`, `packages/compiler/README.md:8-9`.

## Proposal

### D1 (0543). Frames on a throw's `diag`
- **Where the frames come from.** The server stops routing loader, action, runner and request throws through `attempt` and keeps the thrown value: a server-internal `caught(fn)` (`packages/server/src/internal/caught.ts`) returns the same `keel.unexpected` KeelError `attempt` gives, plus `frames` read from the thrown value's `stack`. Kernel source may catch; E1452 governs app code. `attempt` is unchanged: a KeelError is a value that reaches results, the browser and session captures, and a stack there would leave the process (default 4). The backlog line suggested `data`; this keeps the stack out of every value.
- **Which frames.** Each stack line after the first that has a `<file>:<line>:<col>` position. The file is made relative to `process.cwd()`; a frame outside the working directory (Node internals, a home directory, the global store) is dropped, and so is one under `packages/`, `node_modules/` or `.keel/`, E1576's definition of library code. The first 5 left are kept. A throw with no `stack` (a thrown string) has `frames: []`. Function names are not kept: the position is enough to find the line, and a name is one more string to scrub.
- **Scrub.** Each frame passes `scrubbed(frame, rq.pii)` before the record is written, as the message does (`createApp.ts:197`). A runner has no request, so its frames are scrubbed against an empty set, as its message is today.
- **Record.** JSON: `{ kind: "diag", code, message, see, frames }`, `frames` present only on a throw's `diag`. Compact: unchanged, one line per record (OUTPUT.md).
- **Production.** `dist/<name>/server.mjs` bundles every dependency, so production frames name positions in `server.mjs` unless Node maps them. Question 1.
- Files: `packages/server/src/internal/caught.ts`, `appFrames.ts` (new); `Diag.ts`, `diagLine.ts`, `runLoaders.ts`, `runAction.ts`, `keepRunning.ts`, `createApp.ts`.

Default applied: 4 (the stack never enters a value; frames are scrubbed and project-relative), 2 (`attempt` stays the one catch for apps; no second public catch).

### D2 (0544). The kernel's sink rungs ship with `@keel/cli`
- `tooling/generate.mjs` gains one output, `packages/cli/src/internal/KERNEL_SINK_RUNGS.ts`: `{ [clause]: rung }` for the clause ids `PII_SINKS.ts` names, read from `tooling/ledger/ledger.json` `clauses`. `--check` reports drift as S0007, as for the other outputs, so a ledger re-commit that changes a sink rung fails CI until the file is regenerated.
- `bundleWrite.ts:107` becomes `rungs.get(clause) ?? KERNEL_SINK_RUNGS[clause] ?? "none"`. The project ledger wins when it holds the item: in this repo the two agree, and the conformance fixtures (`packages/cli/conformance/evidence-fixture.ts:78-100`) set their own rungs to show coverage dropping.
- The manifest already records each `@keel/*` version (`keel`), so an auditor knows which kernel ledger the shipped rungs came from.
- Generated, not a named file in the project: a file the app holds could claim any rung; a table compiled into the published package states what that release proves.

Default applied: 3 (the existing generator and its `--check`), 6 (CI catches a stale table).

### D3 (0548). E1558 covers server state, in `keel check` and `keel build`
- **Home.** k.topology Rules. The rule is a fact about deployable kinds, k.topology owns the others (E1552, E1553, E1559), and k.server has no room. k.server's API bullet keeps its `(E1558)` pointer and its Rules line points to k.topology.
- **What it matches.** In a `*.server.ts` (or `.server.tsx`) file under `modules/<m>/`, where a `client` or `static` deployable lists `m`: a call of `loader` or `action` imported by name from `@keel/router` whose first argument is an object literal with a `stores` key, or a `loader` call whose second argument is an `async function*` expression. One finding per call, at the call. Message: `<adapter> deployable <name>: <loader|action> names stores (or: is live); serve module <m> from a node deployable`.
- **Where it runs.** `serverOnlyCalls(files, topology)` in `@keel/compiler` (`packages/compiler/src/serverOnlyCalls.ts`, exported beside `pathCollisions`), called by `checkCommand.ts:26` and `buildCommand.ts:41` with the project files and topology they already hold.
- **`createApp`.** `selectDeployable.ts:37-42` widens its test from `r.def.loader?.live` to a live loader, a loader with `stores`, or an action with `stores`, and throws E1558 with the same message.
- **Explanation.** `EXPLANATIONS.ts` gains an E1558 row (`keel explain E1558` answers "not a known code" today): `["E1558", "live loader, or loader or action naming stores, in a module a client or static deployable serves", "Server state and event streams run on a node deployable only; the browser refuses them.", "serve the module from a node deployable, or drop stores from the loader or action", "k.topology"]`.
- **Not covered.** A `loader`/`action` reached through a namespace import or a wrapper function, or a `stores` key added by spread, is not read. The run-time refusal (`STORES_SERVER_ONLY`) stays as depth.

Default applied: 6 (a static rule before run time), 3 (the `pathCollisions` call path in both commands), 5 (server state stays on a server).

### D4 (0557). A per-source cap inside the global window
- **Source.** The last entry of `x-forwarded-for` (the address the nearest proxy saw), else the peer address the Node server gives (`c.env.incoming.socket.remoteAddress` under `@hono/node-server`), else none.
- **Counting.** A window holds `logged`, `dropped` and a `Map<source, count>`. A report is logged when `logged < 100` and its source's count `< 10`; a report with no source needs only `logged < 100`. Otherwise it is counted in `dropped`. The map gains an entry only when a report is logged, so it holds at most 100 entries, and the window's end clears it with the counters.
- **Privacy.** The address never reaches a record or a file; the `csp` and `dropped` records keep their shape. It lives in process memory for at most 60 s, which k.privacy does not count as a sink.
- **What it buys.** One source can take at most 10 of the 100. A client that forges `x-forwarded-for` on a server with no proxy in front can spread its reports over many sources; that reaches the 100 and no further, which is the behavior today.
- **Existing tests.** `security-report-window.test.ts` posts with no source, so its 100 logged, `dropped: 1` and the 101..130 property hold unchanged.
- Files: `packages/server/src/internal/cspReport.ts`, `ReportWindow.ts`, `createApp.ts:163` (window init) and `:205` (passes the Hono context's env).

Default applied: 4 (no address in any record), 6 (the server enforces it).

### D5 (0558). Tighten k.compiler
- Removed: the routes.json bullet's "`...x.routes`, `x` a `deps` package's `routes` export, reads as its literals." (the Conformance clause "`...x.routes` of a `deps` package reads its literal routes; of another package it is W1005." states it), and Escaping by context's "Every `srcdoc` renders as `about:blank`; a `<base>` `href` or `<meta>` `http-equiv` is never rendered." (the clauses "Any `srcdoc`, and a `vbscript:` URL in any URL attribute, is E1003 as a literal and `about:blank` when bound." and "... any `<base>` `href` or `<meta>` `http-equiv` is E1003, never rendered." state it). No header quotes either sentence.
- E1004 names the three forms; one clause covers them and the type-only exception.
- The split, rejected for now: a new `k.artifacts` ("Generated artifacts") taking the Artifacts paragraph and its clauses would change the section id of 6 files (`packages/cli/conformance/artifact-tamper-e1005.test.ts`, `artifact-forged-e1005.test.ts`, `artifact-routes-literals.test.ts`, `packages/compiler/conformance/route-fragment-spread-0077.test.ts`, `packages/testing/conformance/compiler-keel-dir-tamper.test.ts`, `compiler-ids-find.test.ts`). It is the seam for the next k.compiler addition.

### D6 (0565). Kernel-only entries move under `internal`
- `packages/server/package.json`: `"./dom"` becomes `"./internal/dom"` pointing at a new `./src/internal/dom/index.ts` that re-exports `installServerDom` (so `budgets.mjs` finds the entry); `"./start"` becomes `"./internal/start"`, its file moved to `./src/internal/start.ts`.
- `packages/compiler/package.json`: `"./entry/*"` becomes `"./internal/entry/*"`, still `./src/entry/*.ts`. The existing `"./internal"` (`./src/globals/index.ts`) is an exact key and does not collide with the pattern.
- Every importer changes in the same commit: `packages/compiler/src/internal/serverEntryCode.ts:6`, `:7`, `:20` (and its doc comment `:11`, `:14`); `packages/compiler/src/internal/devEntryCode.ts:8`; `packages/server/src/createApp.ts:1`; `packages/server/src/internal/servedEntry.ts:1-2`; `packages/server/src/internal/loadAssets.ts:1`; `packages/compiler/test/clientBuild.test.ts:6-7`; `packages/server/src/start.ts:17` doc comment; `packages/server/README.md:7`; `packages/compiler/README.md:8-9`; `tooling/budgets.json:39-40`.
- E1576 then refuses each from app code with no rule or spec change. Naming them in the rule instead would add three literals to `@keel/check` (169 B left) and a list to k.security that grows with every new seam.

Default applied: 6 (the guard covers them), 2 (one convention marks a kernel seam: the `internal` segment).

## Alternatives
- **0543: the stack in `data.stack` of `keel.unexpected`**, rejected: the KeelError reaches results, the browser and session captures (default 4), and every consumer would need its own scrub.
- **0543: `attemptWith` in `@keel/schema/internal`**, rejected: a second catch API in a package the browser loads, for one server need; the server's own catch adds nothing to `@keel/schema`.
- **0543: keep function names in frames**, rejected: positions find the line, and names are more text to scrub.
- **0544: read rungs from a file the project names in k.privacy**, rejected: the app could claim any rung, and the bundle's point is that an auditor need not trust the source.
- **0544: ship `ledger.json` whole as JSON**, rejected: `tsc` does not copy JSON into `dist`, and the bundle needs four items.
- **0548: a `keel check` rule in `@keel/check` only, as E1511**, rejected: `keel build` would still pass; `pathCollisions` already runs in both.
- **0548: a new code beside E1558**, rejected: one code for "server-only route work in a deployable without a server" (default 2).
- **0548: link each route literal to its loader import**, rejected: needs import resolution across files for no gain; a `*.server.ts` in a module without a server has no use for `stores`.
- **0557: key by caller cookie**, rejected: the CSP path has no caller, and Reporting API beacons send no cookies.
- **0557: dedupe by `(directive, blocked, route)`**, rejected: an attacker varies `blocked` at will.
- **0557: a trusted-proxy option**, rejected here: a new `createApp` option, which WORKFLOW escalates; forging only returns to today's shared cap.
- **0558: split now**, rejected: 6 header changes against 0, and the tightening fits.
- **0565: name the entries in E1576**, rejected above.

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/kernel/*.md` at `bcba4bf`.

### k.server (1,442 to 1,464)
**Build**, replacement text:

> **Build.** Production `assets`: k.deploy. Runners, peers, `keel dev` and the document entry without `assets`: k.topology.

**Log**, replacement text:

> **Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (personal data dropped, k.privacy; a throw's `frames`: its first 5 stack positions in app code (E1576's), each `<path>:<line>:<col>` relative to the working directory), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line.

**Rules**, replacement text:

> **Rules.** E1551 `loader`/`action` outside `*.server.ts` · E1554 loader data fails its output schema (dev diag; production 500) · E1558 (k.topology).

**Conformance**, appended:

> - A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the working directory.

### k.topology (1,017 to 1,192)
**Local topology**, replacement text:

> **Local topology.** `keel dev` serves every deployable in one process on one origin: Vite serves `client` and `static` entries with HMR; each `node` deployable runs its dev `createApp` (real `ctx`, storage in `.keel-dev/`) and runners, the others its in-process peers, and serves its paths; its documents resume its own islands. In dev, or with no `assets` in development/test, a document scripts `/@keel/entry.ts?d=<deployable>`, the resume entry of the islands of `createApp({ deployable })`'s modules (none given: every `node` module's).

**Rules**, replacement text:

> **Rules.** E1552 `topology.ts` not statically readable, a name not `[a-z][a-z0-9-]*`, a module unknown or in two deployables · E1553 a `static` route with params or actions · E1559 one path in two deployables (names both; `keel check` and `keel build`) · E1558 a live loader, or a `loader` or `action` naming `stores`, in a `*.server.ts` of a module a `client` or `static` deployable serves (at the call in `keel check` and `keel build`; `createApp` throws it; fix: none) · E1511 (k.api) · E1560 (k.deploy).

**Conformance**, appended:

> - In a module a `client` deployable serves, a `loader` naming `stores`, an `action` naming `stores` and a loader whose `fn` is `async function*` are each one E1558 in `keel check` and `keel build`, and `createApp` for that deployable throws E1558; in a `node` deployable's module none is.

### k.privacy (1,102 to 1,145)
**Sinks**, the Server log item, replacement text:

> - Server log (k.server): before a `diag` record is written, each of `piiValues` of the request's decoded action input, its loaders' outputs and its factories' store states is replaced by `[pii]` in the message and in each of its `frames`.

**Conformance**, appended (after clause 8, so `k.privacy#6` and `#7` keep their numbers):

> - An action throwing an `Error` whose stack names a file path holding a marked input value logs that frame with `[pii]` in place of the value.

### k.evidence (1,106 to 1,179)
**Command** table, the `pii.json` row, replacement text:

> | `pii.json` | per `.pii()` path (file, export, path, class), each sink (k.privacy) and the rung of its clause (sessions `std.sessions#2`, inputs `k.privacy#7`, log `k.privacy#6`, bundle `k.evidence#5`): the project ledger's when it holds that item, else the kernel ledger's that `@keel/cli` ships; `coverage`, the share of (path, sink) pairs at `probabilistic` or higher |

**Conformance**, appended (`k.evidence#5` keeps its number):

> - In a fixture with no `spec/` and no conformance files, each `pii.json` sink carries the rung `@keel/cli` ships for its clause, and `coverage` is 1 when those are all `probabilistic` or higher.

### k.security (1,398 to 1,481)
**Reports**, replacement text:

> **Reports.** `POST /__keel/csp` takes `application/csp-report` and `application/reports+json` bodies up to 16 KiB (else 413, nothing logged) without the write proof, since it changes no state, and answers 204. Each report is one `csp` log record `{ kind: 'csp', directive, blocked, route }`: `blocked` is `inline`, `eval`, `trusted-types` or the blocked URL's origin; `route` is the route id the document URL matches, else `-`. No path, query or sample is logged. In each 60 s of `ctx.clock` at most 100 reports are logged, at most 10 per source (the last `x-forwarded-for` entry, else the peer address; held for the window, never logged; none: the 100 only); the rest are counted, and the window's end writes one `csp` record `{ kind, dropped }`.

**Conformance**, appended:

> - In one window, 50 reports with `x-forwarded-for: 192.0.2.1` log 10 and a later one from `192.0.2.2` is logged; `dropped: 40` follows the window; no record holds an address.

### k.compiler (1,500 to 1,498)
**Escaping by context**, replacement text:

> **Escaping by context.** Attributes and properties are set through the DOM. Server HTML escapes text and attribute contexts separately. **URL policy** (runtime ops, `Link`/`Image`): URL attributes are `href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `data`, `ping`/`srcset`/`imagesrcset` (each URL; split at spaces, commas), and `to`/`from`/`by`/`values` on any element (each `;` item). Navigation attributes (`href`, `action`, `formaction`, `Link to`) take an `Href` from `routes.href()` or an absolute URL; a literal there starting with `/` or matching a `routes.json` path pattern is E1501. The rest are assets: relative literals pass. A value with a URL whose parsed scheme is not `http`, `https`, `mailto`, or `tel` renders as `about:blank`. Raw HTML has no API outside `unsafe`.

**Artifacts**, the `routes.json` item, replacement text:

> - `routes.json`: `{ [routeId]: { path, params, search, actions, layout, guard, module } }`; schemas as JSON Schema. An id, `path`, `layout`, `actions` or guard `redirect` unlike its `routes.ts` literal is E1005.

**Rules**, the E1004 entry, replacement text:

> E1004 a `*.server.ts` module named by a value import, re-export or literal `import()` in client-reachable code (per deployable listing the file's module; not when all of them declare no server, nor for the `routes.ts` of a module only `node` deployables list; never outside `modules/`)

**Conformance**, appended:

> - `export * from './a.server'` and `import('./a.server')` in client-reachable code are each E1004; `export type` from it is not.

### Unchanged
k.errors (1,492), k.check, k.cli, k.module, k.testing, k.router. `spec/00-map.md` is unchanged: E155x already lists k.server and k.topology, E100x k.compiler. D6 changes no spec text: no section names the three entries.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:

New files:
- `packages/server/conformance/log-diag-frames.test.ts` (D1):
  - `// Spec: k.server, Conformance "A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the working directory."`
  - `// Seed: 1337.` Cases: a loader, an action and a runner that throw from an app file, json log; a thrown string gives `frames: []`; a property over generated stack texts (frames from app files, `packages/`, `node_modules/`, absolute paths outside the working directory, `node:` lines): `frames` is the first 5 app positions in order.
- `packages/server/conformance/privacy-frames-scrub.test.ts` (D1):
  - `// Spec: k.privacy, Conformance "An action throwing an `Error` whose stack names a file path holding a marked input value logs that frame with `[pii]` in place of the value."`
- `packages/cli/conformance/evidence-shipped-rungs.test.ts` (D2):
  - `// Spec: k.evidence, Conformance "In a fixture with no `spec/` and no conformance files, each `pii.json` sink carries the rung `@keel/cli` ships for its clause, and `coverage` is 1 when those are all `probabilistic` or higher."`
- `packages/cli/conformance/topology-e1558-server-state.test.ts` (D3, the `keel check` and `keel build` half):
  - `// Spec: k.topology, Conformance "In a module a `client` deployable serves, a `loader` naming `stores`, an `action` naming `stores` and a loader whose `fn` is `async function*` are each one E1558 in `keel check` and `keel build`, and `createApp` for that deployable throws E1558; in a `node` deployable's module none is."`
  - `// Spec: k.topology, Rules "E1558 a live loader, or a `loader` or `action` naming `stores`, in a `*.server.ts` of a module a `client` or `static` deployable serves (at the call in `keel check` and `keel build`; `createApp` throws it; fix: none)"`
- `packages/server/conformance/e1558-server-state-non-node.test.ts` (D3, the `createApp` half), same Conformance header.
- `packages/server/conformance/security-report-source.test.ts` (D4):
  - `// Spec: k.security, Conformance "In one window, 50 reports with `x-forwarded-for: 192.0.2.1` log 10 and a later one from `192.0.2.2` is logged; `dropped: 40` follows the window; no record holds an address."`
  - `// Seed: 1337.` Plus a property: for generated report sequences over a few sources, logged per source is at most 10, total at most 100, `logged + dropped` equals reports sent, and no line holds a source string.
- `packages/compiler/conformance/E1004-reexport-import.test.ts` (D5):
  - `// Spec: k.compiler, Conformance "`export * from './a.server'` and `import('./a.server')` in client-reachable code are each E1004; `export type` from it is not."`

Changed files:
- `packages/server/conformance/e1558-live-loader-non-node.test.ts:2`: the comment `// Rule E1558 (k.server): a live loader a non-`node` deployable serves.` becomes `// Rule E1558 (k.topology): a live loader, or a loader or action naming stores, a non-node deployable serves.` No `// Spec:` header changes section id.
- Kept green with no edit: `packages/server/conformance/security-report-window.test.ts` (reports with no source), `privacy-diag-scrub.test.ts` (the message scrub), `packages/cli/conformance/evidence-pii-coverage.test.ts` (the fixture's own ledger wins), every `// Spec: k.compiler` file (no quoted text moves).
- Ledger: new items `k.server#16`, `k.topology#8`, `k.privacy#9`, `k.evidence#10`, `k.security#13`, `k.compiler#20`; no item renumbers.

## Lanes and build order
- **Step 1, orchestrator:** the spec diff above in one commit, and `tooling/budgets.json` (Budget).
- **Step 2, conformance-writers in parallel:** one per item (D1 to D5; D6 has no clause).
- **Step 3, in parallel:**
  - Lane A, compiler and server, D6 first: one commit across both packages (the export rename and its importers must land together). Small; it touches `createApp.ts:1`, so it goes before lane C.
  - Lane B, cli and tooling, D2: `generate.mjs` output, `KERNEL_SINK_RUNGS.ts`, `bundleWrite.ts`.
  - D5 needs no code: the rule already behaves as stated.
- **Step 4, in parallel after lane A:**
  - Lane C, server, sequential in one agent since all three touch `createApp.ts`: D1, then D4, then D3's `createApp` half (`selectDeployable.ts`).
  - Lane D, compiler, check, cli: D3's `serverOnlyCalls` and the E1558 explanation row, then the cli wiring in `checkCommand.ts` and `buildCommand.ts` (other files than lane B's).
- Root gates, ledger on a quiet tree, push.

## Migration
What fires in the repo with all six in:
- D1: json `diag` records for a throw gain `frames`. Tests that compare a whole throw `diag` line get the field; non-throw diags are unchanged. No app change.
- D2: none in this repo (the project ledger has all four items). An app outside it gets its sink rungs from `@keel/cli`, and its `coverage` rises from 0.
- D3: none. `stores` and the one live loader are in modules `node` deployables serve (golden-1 `api`, `digest`; golden-2 `kitchen`); `apps/inspector`'s `loadInspect.server.ts` has a local named `stores`, not a `stores:` option; the `cart-bug` fixture has no `*.server.ts`.
- D4: none. Every current test posts without a source.
- D5: none.
- D6: no app, eval, scaffold template or test outside `packages/` imports the three entries; the generated entries change with the rename. An app outside the repo that imports `@keel/server/dom`, `@keel/server/start` or `@keel/compiler/entry/*` fails resolution (the old keys are gone), and the new paths are E1576.

## Token impact
| section | before | after |
| --- | --- | --- |
| k.server | 1,442 | 1,464 |
| k.topology | 1,017 | 1,192 |
| k.privacy | 1,102 | 1,145 |
| k.evidence | 1,106 | 1,179 |
| k.security | 1,398 | 1,481 |
| k.compiler | 1,500 | 1,498 |

The E1558 `explain` row is under the 120-token cap (its four fields are 70 tokens).

## Budget
Measured with `tooling/budgets.mjs`'s method (own code bundled, dependencies external, minified, gzip) on copies of `src` with the sketched change.
- `@keel/compiler`: 29,447 of 29,696 B today; with `serverOnlyCalls` 29,792 B, 96 over. **Re-base to 29.25kb (29,952 B)**, reason: a kernel rule in `keel check` and `keel build` (default 7).
- `@keel/cli`: 24,549 of 24,576 B today; with the D3 wiring 24,578 B, 2 over. **Re-base to 24.25kb (24,832 B)**, same reason. D2 lands in `@keel/cli/evidence`, which has no budget line (17,785 to 17,829 B).
- `@keel/check`: 48,471 of 48,640 B; with the E1558 row 48,548 B. Fits; 92 B left.
- `@keel/server`: 19,315 of 20,224 B. D1, D3 and D4 are estimated at 400 to 600 B together; measure on the branch, and re-base only if it breaches.
- `@keel/server/dom`: **rename the key to `@keel/server/internal/dom` and re-base to 4.75kb (4,864 B)**. The `2kb` line measures nothing today (no entry file at the path `budgets.mjs` reads); the entry bundles to 4,623 B. This is a first measurement, not a lowered threshold.
- `@keel/server/start`: rename the key to `@keel/server/internal/start`; limit unchanged.
- `@keel/router` (17 B left), `@keel/testing` (7 B left), `@keel/schema`: untouched.

## Known limits
- D1: production frames name positions in the `server.mjs` bundle unless Node maps them (Question 1). A frame under an app folder named `packages/` is dropped, as E1576 treats that folder.
- D3: calls through namespace imports, wrappers or spread `stores` keys are not read; the browser's refusal stays.
- D4: without a proxy, a forged `x-forwarded-for` spreads one client over many sources, up to today's shared 100.
- `keel explain E1559` answers "not a known code"; out of scope here, the orchestrator may file it.

## Questions
The defaults decide every item: 4 (D1's stack stays out of values; D4 logs no address), 2 (D1 keeps one public catch; D3 keeps one code; D6 one seam convention), 3 (D2's generator, D3's call path), 5 (D3), 6 (D2's drift check, D3, D4, D6) and 7 (the re-bases). No new user-facing API shape, no privacy or auth weakening, no external integration, no golden-app migration. Open points, with recommendations:
1. **Production frames.** Should the `node` server build write `server.mjs.map` and `start` call `process.setSourceMapsEnabled(true)`, so production frames name app files? Recommendation: yes, as its own backlog line (it touches `@keel/compiler`'s build and `@keel/server/internal/start`, and adds a file to the deploy image).
2. **The per-source cap.** 10 of 100, sources from the last `x-forwarded-for` entry with no trusted-proxy setting. Recommendation: accept; a proxy option is a new `createApp` field and waits for a deployment that needs it.
3. **`@keel/server/start` in D6.** The backlog line named two entries; the third has the same property and the same importer. Recommendation: include it, as written.
