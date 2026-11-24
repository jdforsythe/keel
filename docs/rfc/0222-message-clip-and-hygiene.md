# RFC 0222: a diagnostic's message is clipped by one exact rule; `replay` and `minimize` take `mount`; std.db conformance-covered

Status: accepted (ADR-0244), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.check (Diagnostics, Conformance), k.test-run (Results), std.sessions (API, Conformance), std.db (status), the map, the std index, `docs/OUTPUT.md`, `docs/TESTING.md`, `docs/freeze-review.md`. Carries conformance hygiene under its tag. From backlog 1080, 1092, 1091, 1085, 1023.

## For the operator
1. **The clip rule lives in k.check, not k.errors.** k.errors is Results and boundaries; k.check's Diagnostics paragraph already owns "`message` is one line under 90 chars" and its Pipeline step 4 owns rendering. One place states it.
2. **No cut splits a surrogate pair.** The build cuts at 86 UTF-16 code units and can leave a lone high surrogate before `...`. The rule keeps 85 then (88 in all). The build changes.
3. **Every `diag` record is clipped where a command renders it** (`respond`), so a producer that forgot to clip still meets the contract, and `keel test`'s T0001 moves from 90 characters (87 and `...`) to the same rule.
4. **`check-budget-injected10` keeps reading `apps/golden-1`.** Its clause is about golden app 1's output, and the case already asserts the ten injected codes and `10 errors`, so an app change cannot hollow it.
5. **std.db flips to `conformance-covered`.** All 13 clauses are at `example` in the ledger and CI's `postgres` job sets `KEEL_TEST_POSTGRES_URL` for `driver-contract.test.ts`, clause 1's Postgres 17 half.

## Problem
- No spec text says how a message is clipped. `docs/OUTPUT.md` and k.check say "under 90 chars". The build: `packages/check/src/internal/clip.ts` collapses each whitespace run holding a line feed to one space, trims, and past `n` (89 at every message site) keeps `slice(0, n - 3)` and `...`; `packages/cli/src/internal/makeDiag.ts` keeps `slice(0, 86)` and `...` past 89, without the whitespace step; `packages/testing/src/testResults.ts` keeps 87 and `...` past 90, a 90-character message. All count UTF-16 code units (`length`), and `slice` can end on the first half of a surrogate pair. The formatters (`diagCompact`, `diagPretty`, json) never clip, and `normalize` does not either, so a producer that skips `clip` emits a longer message in every format.
- std.sessions says in prose that `replay` and `minimize` take `mount` and that `mount` with `serve` is E1722; no Conformance clause states it, and `to-test-identity-mount.test.ts` records it as untestable.
- Three conformance header quotes no longer match their spec text (1091). Fourteen std-sessions conformance cases run an in-process `check` under vitest's 5 s default (1085). Six conformance tests read app files under `apps/` as fixtures (1023).
- std.db is `proposed` for a reason that no longer holds.

## Proposal
### The clip rule (k.check Diagnostics)
A message is one line of at most 89 characters counted in UTF-16 code units: each run of whitespace holding a line feed becomes one space and the ends are trimmed (`String.prototype.trim`); a longer message keeps its first 86 code units, or 85 when the 86th is the first half of a surrogate pair, followed by `...` (three full stops). Every `diag` record a command emits is clipped so before it is rendered, so compact, pretty and json, and MCP and LSP, carry the same message. Code units, not code points or graphemes: they are what JavaScript, the json consumers and the existing tests count, and graphemes would need `Intl.Segmenter` in the CLI for an edge no message has today.

### `replay` and `minimize` with `mount`
Without `serve`, `mount` goes to `renderRoute` and, for a page with no guard, changes nothing a replay returns. With `serve`, the call calls `serve` once and rejects with E1722 from `renderRoute`, the app unrequested. Two clauses state both exactly.

### The bound rule (docs/TESTING.md)
A conformance case or hook that runs `check` in process, or a `keel` command (`run`, or the binary as a child), passes its own timeout: at least 30 s, at least 60 s when the command runs app code under `keel test` (`test`, `session replay`, `minimize`, `to-test`); a new bound takes the floor. Every existing bound in the repo meets it.

### std.db
`status: conformance-covered`, as `docs/freeze-review.md` requires (no clause at `partial`, `todo` or `none`; `keel ledger --diff` E1707 otherwise).

## Alternatives
- Code points or graphemes: rejected above. A cut that may split a pair: emits a lone surrogate, which json encodes as `\ud83d` and a terminal shows as a replacement mark.
- Clip only at producers (as built): every new producer must remember; one funnel in `respond` makes the contract hold by construction.
- Keep T0001 at 90: two rules for one record kind; 90 is not "under 90".
- Put the rule in k.errors: it owns `KeelError`, not E-code diagnostics.

## Spec diff
Applied in this commit.
- k.check (to `implemented` until clause 22 is covered): Diagnostics states the rule; Conformance gains #22, appended.
- k.test-run (stays `conformance-covered`): T0001's message is clipped as k.check says, in place of "cut at 90 characters". No clause quotes the old words.
- std.sessions (stays `implemented`): the `mount` sentence says `serve` is called once and the app is unrequested; Conformance gains #18 and #19.
- std.db: `conformance-covered`; the std index row likewise; the map's k.check row reads `implemented`.
- `docs/OUTPUT.md` Fields: the rule in short. `docs/TESTING.md` Wall-clock bounds: the bound rule. `docs/freeze-review.md`: k.check and std.db rows and the Status count.
- No glossary term, section or diagnostic code is added.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/diag-message-clip.test.ts` (new): k.check#22.
- `packages/std-sessions/conformance/replay-mount.test.ts` (new): std.sessions#18 and #19. `to-test-identity-mount.test.ts`: drop its UNTESTABLE line.
- 1091, re-quotes only: `packages/scaffold/conformance/service-file.test.ts` line 1 quotes k.scaffold Generators' current `service` bullet ("`service`: a client of an API no app module serves (k.services): `modules/<id>/<Name>Api.schema.ts` and `api.server.ts`, with `@keel/services` in `package.json` (k.scaffold-service)."); `packages/scaffold/conformance/cli-service-flags.test.ts` line 5 quotes "`route`: ... `no-loader` with `api`, is E1052" (the comma); `packages/std-sessions/conformance/to-test-served.test.ts` line 9 cites `k.boundary, Reach`, not `std.sessions, k.boundary Reach`.
- 1085, bounds only (30_000, each an in-process `check`): `packages/std-sessions/conformance/E2001-redact-path.test.ts` lines 12, 15, 18, 21; `E2005-adapter-not-node.test.ts` lines 20, 23, 26, 42, 62, 66, 73; `e2009.test.ts` lines 245, 251, 257. `to-test.test.ts:43` has its 30_000 already. The writer applies the rule to the rest of the folder and to any case it touches elsewhere.
- 1023, a fixture of the test's own under its package's `conformance/fixtures/`, keeping each case's claim:
  - `packages/check/conformance/E1406-text-node.test.ts:250`: `fixtures/text-children/`, a module whose JSX children are text (strings, numbers, a contract `href`, called slots), type pass on with `root` the package; no E1406.
  - `packages/check/conformance/client-pii.test.ts:115-122`: `fixtures/pii-server-only/`, a module with `.pii('contact')` stores reached only from `*.server.ts`, and a client module with none; no E1107.
  - `packages/check/conformance/E1759-node-globals.test.ts:413-433`: `fixtures/node-globals-app/`, a project with `topology.ts` (a `node` and a `client` deployable), a browser component, a server file importing `node:fs` and a `vite.config.ts` reading `process.env`; no E1759, and `process.env.X` added to the component is one E1759 at it.
  - `packages/check/conformance/rules-rfc0040.test.ts:14`: `root` is the package itself; `@keel/router` joins `@keel/check`'s devDependencies (router precedes check in `tooling/deps.json`).
  - `packages/std-messages/conformance/copy-not-followed.test.ts:179-190`: `fixtures/copy-followed/` (a module listing `@keel/std-messages` whose copy follows std.copy) and `fixtures/copy-unlisted/` (a module that does not list it); no E2406.
  - `packages/cli/conformance/check-budget-injected10.test.ts`: unchanged (For the operator, 4).

## Migration
None. No app is released.

## Token impact
- Spec: k.check 2,766 to 2,988 tokens; std.sessions 2,478 to 2,650; k.test-run 817 to 824; k.errors unchanged at 1,543; the map 1,489 to 1,487. All within 3,100.
- `@keel/cli`: one clip in `normalize`; `@keel/check`, `@keel/testing`: a surrogate test in `clip`. Sizes measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text, docs. 2. `conformance-writer`: the two new files and the hygiene above, under `rfc:0222`. 3. Build:
- `packages/cli/src/internal/normalize.ts`: clip every `diag` record's message by the rule; `makeDiag.ts` uses the same function.
- `packages/check/src/internal/clip.ts`: the surrogate step; `packages/testing/src/testResults.ts`: the rule at 89 in place of 90.
- `packages/check/package.json`: `@keel/router` in devDependencies.
- Docs: a changeset; `tasks/BACKLOG.md` 1080, 1085, 1091, 1092, 1023.
- The ledger: k.check#22 and std.sessions#18, #19 at `none` until covered (`ledger-fresh` lists them; the orchestrator regenerates).
