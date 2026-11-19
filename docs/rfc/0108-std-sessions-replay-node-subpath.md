# RFC 0108: std-sessions: `replay` on the node subpath

Status: implemented. Accepted (user for the decisions, orchestrator for the choices, 2026-11-17). For backlog 0714. ADR-0131 records it.

## Decisions
- D1: `replay` leaves the root entry of `@keel/std-sessions`. It is imported from `@keel/std-sessions/replay` only, the subpath that already exists. The root keeps `record`, `redact`, `session`, `Session`, `SessionEvent`, `SessionsConfig` and the types `RecordOptions`, `Recorder`, `ReplayResult`, `SessionSink`; a type import costs no bytes.
- D2: `@keel/testing` moves in `@keel/std-sessions` from `dependencies` to an optional `peerDependencies` entry, and stays in `devDependencies` for the package's own tests. Only the node subpaths load it (`./replay`, `./minimize`, `./commandJob`, `./group`), and every project that runs them has it already: `keel session replay`, `minimize` and `to-test` run under `keel test`, and the scaffold lists `@keel/testing` in `devDependencies`.
- D3: `apps/golden-1` moves `@keel/testing` and `@keel/std-conflicts` from `dependencies` to `devDependencies`: only its `test/` files import them. `apps/sessions` already lists `@keel/testing` under `devDependencies`.
- D4: std.sessions names the entry in the `replay` sentence and states that the root imports no `@keel/testing`; a conformance case bundles the root and checks it. The section stays at 1,500 tokens (6,000 to 5,999 characters) by tightening the same paragraph.

## Problem
Read on `jdforsythe/test-impl` at `4e5c2abd`.

`packages/std-sessions/src/index.ts` re-exports `replay` from `./replay.ts`, which imports `replayRun`, which imports `renderRoute` from `@keel/testing` and through it the axe-core build behind `packages/testing/unsafe/axeSync.ts`. The root entry is the browser entry: `record` runs in the page, and `tooling/budgets.json` holds it to `7.5kb` as a `browser` bundle. `tooling/budgets.mjs` bundles each entry with `packages: "external"`, so the budget never counts `@keel/testing`; it measures the root's own code, and the import of `@keel/testing` is invisible to it. A client bundle that imports anything from the root keeps the harness out only because a bundler tree-shakes `replay`; an import of `replay` by mistake, or a bundler that cannot prove `replayRun` free of side effects, ships the test harness and axe-core to the browser.

`replay` is a developer tool: the `keel session` commands and tests call it. It already has its own subpath, `./replay`, in `package.json` `exports`; `minimize` is in its subpath only (`./minimize`), and the README says so. `replay` is the one node tool also on the root.

Importers of `replay` from the root: `packages/std-sessions/conformance/replay-reproduces.test.ts`, `E2003-replay-input.test.ts`, `net-event.test.ts`, `overflow-rebase.test.ts`, `minimize.test.ts`; `packages/std-sessions/test/replay-redact.test.ts` (package name), and `net-record.test.ts`, `replay-followon.test.ts`, `minimize-missing-store.test.ts`, `redteam.test.ts`, `redactSession.test.ts` (`../src/index.ts`); `apps/sessions/test/resumeReplay.test.ts`. No app source file imports it; `apps/golden-1` names the package in its module's `std` config and imports only `@keel/std-sessions/monitor`.

## Proposal
**Export map.** `package.json` `exports` is unchanged: `.` and `./replay` both exist today. `src/index.ts` loses one line:

```ts
export { replay } from "./replay.ts";
```

**Dependencies** (`packages/std-sessions/package.json`):

```json
"peerDependencies": { "@keel/testing": "workspace:*" },
"peerDependenciesMeta": { "@keel/testing": { "optional": true } },
"devDependencies": { "@keel/testing": "workspace:*", ... }
```

and `@keel/testing` leaves `dependencies`. Optional, because a project that only records sessions in the browser and serves `./routes` never loads the node subpaths. Peer rather than dev, because the node subpaths import it at run time in the consumer's project, which must resolve it; a dev dependency of this package is not installed for its consumers. The other runtime dependencies the node subpaths carry (`vite`, `vitest`, `happy-dom`, `tsx`) are backlog 0513's and unchanged here.

**golden-1** (`apps/golden-1/package.json`): `@keel/testing` and `@keel/std-conflicts` move to `devDependencies`. `@keel/std-sessions` stays in `dependencies` (its monitor routes and runner are served).

**Imports.** Every importer above changes `import { replay } from "@keel/std-sessions"` (or `"../src/index.ts"`) to `import { replay } from "@keel/std-sessions/replay"` (or `"../src/replay.ts"`), keeping its other names on the root.

**Budget.** The `7.5kb` root budget falls by `replay`'s own code (`replay.ts` and the parts of `replayRun` and `replayStep` no root export uses). No new budget entry: `./replay` is a node entry like `./minimize`, which has none.

## Alternatives
- Keep `replay` on the root and mark `replayRun` side-effect free: still one import away from shipping the harness, and depends on each bundler.
- A runtime throw when `replay` runs without a DOM: does not keep the bytes out.
- A `./node` subpath gathering `replay`, `minimize` and `commandJob`: a second path to things that already have one each (default 2).
- `@keel/testing` as a dev dependency only: a consumer that runs `keel session replay` would fail to resolve it where it is not hoisted.

## Spec diff
std.sessions, the `replay` paragraph, whole new text (before 6,000 characters, 1,500 tokens; after 5,999 characters, 1,500 tokens):

```
`replay(session, { routes, redact? })` (`./replay`; the root imports no `@keel/testing`) renders the base (missing stores: `initial`) under a sim ctx of `seed` (absent: 0) at `at`, with the recording's `redact`, then per event advances the clock to `at` and applies inputs (`fire`, `nav`, `net`: `setOnline`), skipping one the previous input already produced (a click's `submit`, an action's `nav`); others are observations. An input it cannot apply is E2003, so the fingerprint differs. Returns `{ observed, state, error, reproduced, unapplied }`: final `state()`; `reproduced` iff fingerprints match; `unapplied` the input index it stopped at, else `null`. `minimize(session, { routes, maxRuns = 200, redact? })`: ddmin over inputs (at `maxRuns`: smallest found).
```

To pay for the entry, the Commands paragraph drops one comma ("on the deployable serving `route.id` with its modules' `redact`"); its other text is unchanged. No conformance bullet text changes, and no conformance header quotes a changed sentence.

## Conformance diff
One `rfc:0108` commit by the `conformance-writer`:
- New `packages/std-sessions/conformance/root-entry-no-testing.test.ts`, citing the `replay` paragraph: esbuild bundles `@keel/std-sessions`'s root entry (`packages: "external"`, `metafile: true`, platform `browser`) and its imports name no `@keel/testing` path; `"replay" in (await import("@keel/std-sessions"))` is false; `typeof (await import("@keel/std-sessions/replay")).replay` is `"function"`.
- Changed import lines only, no assertion: `replay-reproduces.test.ts:4`, `E2003-replay-input.test.ts:5`, `net-event.test.ts:7`, `overflow-rebase.test.ts:4`, `minimize.test.ts:8` (each in `packages/std-sessions/conformance/`) import `replay` from `@keel/std-sessions/replay`.

## Migration
`import { replay } from "@keel/std-sessions"` becomes `import { replay } from "@keel/std-sessions/replay"`. A project that calls `replay`, `minimize`, `commandJob` or `./group` lists `@keel/testing` itself, as every scaffolded project does under `devDependencies`. In this repo: the five conformance files above, six files in `packages/std-sessions/test/`, `apps/sessions/test/resumeReplay.test.ts`, `packages/std-sessions/README.md` (the root's exports and the subpath list), `apps/golden-1/package.json`, and `pnpm install` for the lockfile.

## Build order
1. Orchestrator: `spec/std/std.sessions.md`. The `conformance-writer`: the conformance diff.
2. One std-sessions lane owns `packages/std-sessions/src/index.ts`, `packages/std-sessions/package.json`, `packages/std-sessions/test/**`, `packages/std-sessions/README.md`, `apps/sessions/test/resumeReplay.test.ts`, `apps/golden-1/package.json`, `pnpm-lock.yaml`, and a changeset (`@keel/std-sessions` minor: a root export leaves). It runs `pnpm install`, then `check`, `build` and the std-sessions suite once, and `pnpm budgets`.
3. Orchestrator: ledger, backlog 0714 closed, HANDOFF.

## Token impact
std.sessions 1,500 to 1,500 tokens (6,000 to 5,999 characters). No other section changes.

## Choices
- C1: the subpath named is the existing `./replay`, not a new `./node` (default 2).
- C2: an optional peer, with the reasons under Proposal; the user's question was peer or dev.
- C3: golden-1's `@keel/std-conflicts` moves with `@keel/testing`: it is test-only there, and it depends on `@keel/testing` at run time.
