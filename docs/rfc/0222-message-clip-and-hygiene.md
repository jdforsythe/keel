# RFC 0222: a diagnostic's message is clipped by one exact rule; `replay` and `minimize` take `mount`; std.db conformance-covered

Status: accepted (ADR-0244), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.check (Diagnostics, Conformance), k.test-run (Results, Conformance), k.ledger (File, Conformance), std.sessions (API, Conformance), std.db (status), the map, the std index, `docs/OUTPUT.md`, `docs/TESTING.md`, `docs/freeze-review.md`. Carries conformance hygiene under its tag. From backlog 1080, 1092, 1091, 1085, 1023; owns the k.ledger File change built for 1083 and 1021.

## For the operator
1. **The clip rule lives in k.check, not k.errors.** k.errors is Results and boundaries; k.check's Diagnostics paragraph already owns "`message` is one line under 90 chars" and its Pipeline step 4 owns rendering. One place states it.
2. **No cut splits a surrogate pair.** The build cuts at 86 UTF-16 code units and can leave a lone high surrogate before `...`. The rule keeps 85 then (88 in all). The build changes.
3. **Every `diag` record is clipped where a command renders it** (`respond`), so a producer that forgot to clip still meets the contract, and `keel test`'s T0001 moves from 90 characters (87 and `...`) to the same rule.
4. **`check-budget-injected10` keeps reading `apps/golden-1`.** Its clause is about golden app 1's output, and the case already asserts the ten injected codes and `10 errors`, so an app change cannot hollow it.
5. **An a11y rung is kept without a report.** `keel ledger` keeps the committed rung of an `a11y` item when its project has no `reports/a11y.json`, so a ledger regenerated where `keel test` did not run does not drop every a11y claim. A kept entry can outlive what it claims: the page can change, or lose the test that rendered it, while no report exists to say so. The bound is the gate: in its clean checkout `keel test` runs in each app first, so every report is present, and `ledger-fresh --a11y` recomputes every item from it; a kept rung never survives the gate. The trailer's `keptNoReport` count makes a kept item visible anywhere else.
6. **std.db flips to `conformance-covered`.** All 13 clauses are at `example` in the ledger and CI's `postgres` job sets `KEEL_TEST_POSTGRES_URL` for `driver-contract.test.ts`, clause 1's Postgres 17 half.
7. **No new record field; the clip is a safety net (D143).** Five codes wrote past 89 units: E1004 (to 145, the chain's tail and the server file lost), E1589 (185), E1580 (96), E1587 (108), E1108 (131). Each message is rewritten to fit for its fixtures' inputs. A suggestion that is an edit goes to `fix`: E1589's `servedBy`, when `topology.ts` has one `node` deployable, and E1108's `deps` entry, when the format comes from a `@keel/std-*` package the module does not list. One that is not an edit goes to `keel explain`: E1580's and E1587's remedies, E1589's other choices, and "only a stdlib format has a literal form". E1004 names the two ends of its chain and elides the middle past the bound. The middle is then printed nowhere: the record has no data for it, `pretty` cannot derive it, and the position (the importer), the entry and the server-only file are what a fix needs.

## Problem
- No spec text says how a message is clipped. `docs/OUTPUT.md` and k.check say "under 90 chars". The build: `packages/check/src/internal/clip.ts` collapses each whitespace run holding a line feed to one space, trims, and past `n` (89 at every message site) keeps `slice(0, n - 3)` and `...`; `packages/cli/src/internal/makeDiag.ts` keeps `slice(0, 86)` and `...` past 89, without the whitespace step; `packages/testing/src/testResults.ts` keeps 87 and `...` past 90, a 90-character message. All count UTF-16 code units (`length`), and `slice` can end on the first half of a surrogate pair. The formatters (`diagCompact`, `diagPretty`, json) never clip, and `normalize` does not either, so a producer that skips `clip` emits a longer message in every format.
- std.sessions says in prose that `replay` and `minimize` take `mount` and that `mount` with `serve` is E1722; no Conformance clause states it, and `to-test-identity-mount.test.ts` records it as untestable.
- Three conformance header quotes no longer match their spec text (1091). Fourteen std-sessions conformance cases run an in-process `check` under vitest's 5 s default (1085). Six conformance tests read app files under `apps/` as fixtures (1023).
- std.db is `proposed` for a reason that no longer holds.
- `keel ledger` recomputed every `a11y` item from `reports/a11y.json`, so a run without the report lowered every committed a11y rung to `none` (1021), and a mutation report file with no scored mutant left its old claim in place, stale for ever (1083). The tooling lane fixed both and added a k.ledger File sentence with no RFC and no clause; nothing asserts it.
- T0001's clip has no clause in k.test-run.

## Proposal
### The clip rule (k.check Diagnostics)
A message is one line of at most 89 characters counted in UTF-16 code units: each run of whitespace holding a line feed becomes one space and the ends are trimmed (`String.prototype.trim`); a longer message keeps its first 86 code units, or 85 when the 86th is the first half of a surrogate pair, followed by `...` (three full stops). Every `diag` record a command emits is clipped so before it is rendered, so compact, pretty and json, and MCP and LSP, carry the same message. Code units, not code points or graphemes: they are what JavaScript, the json consumers and the existing tests count, and graphemes would need `Intl.Segmenter` in the CLI for an edge no message has today.

### `replay` and `minimize` with `mount`
Without `serve`, `mount` goes to `renderRoute` and, for a page with no guard, changes nothing a replay returns. With `serve`, the call calls `serve` once and rejects with E1722 from `renderRoute`, the app unrequested. Two clauses state both exactly.

### The bound rule (docs/TESTING.md)
A conformance case or hook that runs `check` in process, or a `keel` command (`run`, or the binary as a child), runs under a timeout of at least 30 s, at least 60 s when the command runs app code under `keel test` (`test`, `session replay`, `minimize`, `to-test`): its own when it passes one, else its package's configured `testTimeout`. A timeout a case adds takes the floor.

### Messages that fit
- k.check Diagnostics: the clip is a safety net; a suggestion that is an edit goes in `fix`, one that is not in `keel explain`; a path past the bound loses whole leading segments to `.../`, its last segment kept. Conformance #23: every fixture diagnostic of every `reportedCodes()` code is at most 89 units and does not end in `...`.
- E1004 (k.boundary, "E1004's message"): `client code reaches server-only (<entry> -> ... -> <server-only file>)`, the shortest chain, its middle one `...` past the bound, then the ends shortened from the front; with no chain, `client code imports server-only <file>`.
- E1580, E1589 (k.mount Messages), E1587 (k.topology), E1108 (k.formats): each message stated whole, with its length at the fixture's input.
- The path marker is one `.../` in place of the dropped leading segments (`a/b/c.ts`, `.../b/c.ts`, `.../c.ts`), stopping at the last segment, as `shortPath` builds it.
- E1013 (k.bundle Aliases): `'<specifier>' reaches modules/<id>/<path> by an alias`, 62 units at the conformance's longest input; the relative path is the fix's alone. E1011 (k.bundle Service map) is a build line, not a record, so `respond` never clips it; its importer is shortened from the front so the text after the code stays within 89. E1730 (k.guards Test files): `renderRoute names no identity mount; pass identity.ts's default export as mount`, 79 units at every depth, the import path being the fix's. E1592 (61 units plus the module id) and W1608 (77, fixed) fit as built.
- The builder's shortened E1258 (k.claim), E1808 (k.ui), E1571 (k.security) and E1552's key message (k.topology) are stated as built.

### k.ledger (as built in `a11yClaims.ts`, `ledgerCommand.ts`, `mutationClaims.ts`)
- The committed file is the `--write` target, else `.keel/ledger.json`, else `tooling/ledger/ledger.json`. For a project with no `reports/a11y.json`, an item that file holds at `example` or `none` keeps that rung (evidence `example reports/a11y.json` or `none`) and is counted as kept; an item it lacks is computed (`none` without runs). With the report present every item is computed. An item whose route `.keel/routes.json` no longer lists is not emitted.
- The summary `counts` gain `keptNoReport`, the kept items in scope, shown only above 0, after `stale`.
- A mutation report's file with no scored mutant (every one `Ignored`) deletes that file's claim; a file with one scored mutant replaces it as before.

### T0001's clip
`testResults` clips each T0001 message itself, for the repository's reporter as well as `keel test`, so the clause sits in k.test-run, not in k.check #22's `respond` case. An uncaught error's message carries `uncaught: `, so 200 `a`s give 76 of them; a file that failed to run carries the bare message, 86 `a`s.

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
- k.test-run (to `implemented` until clause 7 is covered): T0001's message is clipped as k.check says, in place of "cut at 90 characters"; Conformance gains #7. No clause quotes the old words.
- k.check: the safety-net sentence and Conformance #23. k.boundary: "E1004's message". k.mount: Messages, and Rules' "Fix: none, but E1589's below." k.topology: "E1587's message". k.formats: "E1108's message", and Rules' "fix: below, else none." Each of these four sections goes to `implemented` only if a clause is added; none is, so their statuses stand.
- k.ledger (to `implemented` until clauses 16 to 19 are covered): the File sentence the tooling lane wrote stands; Conformance gains #16 (report absent: rung kept, `keptNoReport`), #17 (report present: recomputed, E1706), #18 (route gone: dropped), #19 (no scored mutant: claim dropped).
- std.sessions (stays `implemented`): the `mount` sentence says `serve` is called once and the app is unrequested; Conformance gains #18 and #19.
- std.db: `conformance-covered`; the std index row likewise; the map's k.check row reads `implemented`.
- `docs/OUTPUT.md` Fields: the rule in short. `docs/TESTING.md` Wall-clock bounds: the bound rule. `docs/freeze-review.md`: k.check and std.db rows and the Status count.
- No glossary term, section or diagnostic code is added.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/diag-message-clip.test.ts` (new): k.check#22.
- `packages/check/conformance/diag-message-fit.test.ts` (new): k.check#23 over `fixtures-by-code.ts`.
- Cases pinning the old messages or the old Rules text, to correct: `packages/check/conformance/bundle-reach.test.ts:45-59` (the four-file chain is now `modules/a/Page.tsx -> ... -> lib/notes.server.ts`); `packages/check/conformance/mount-e1589.test.ts:43,45` (E1589's two texts); `packages/check/conformance/mount-rules.test.ts:1` and `packages/cli/conformance/mount-rules-build.test.ts:1` (k.mount Rules' last sentence); `packages/check/conformance/format-literal-E1108.test.ts:1` (k.formats Rules' fix); `packages/check/conformance/fix-diffs.test.ts:333,369` (E1108 and E1589 now have fixes: a fixture and its diff each). The other E1004 cases (`boundary-reach.test.ts:33,315`, `bundle-reach.test.ts:41,114`, `cli/conformance/bundle-workers.test.ts:66`) hold as written.
- Cases pinning E1013, E1730, E1587 and E1011 text: `packages/check/conformance/bundle-E1013-aliased-import.test.ts:3,4,75-77`; `packages/cli/conformance/bundle-E1013-build.test.ts:2,28`; `packages/check/conformance/testing-E1730-identity-mount.test.ts:1,2,70,182`; `packages/check/conformance/topology-styles-e1587-message.test.ts:1,3`; `packages/compiler/conformance/e1011-client-service-map.test.ts:2` (its Service map quote, if it reaches the `<file>` sentence).
- `packages/cli/conformance/ledger-kept-claims.test.ts` (new): k.ledger#16 to #19.
- `packages/testing/conformance/test-run-t0001-clip.test.ts` (new): k.test-run#7.
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
- Spec: k.check 2,766 to 2,988 tokens; std.sessions 2,478 to 2,650; k.test-run 817 to 914; k.ledger 2,002 to 2,378; k.errors unchanged at 1,543; the map 1,489 to 1,487. All within 3,100.
- `@keel/cli`: one clip in `normalize`; `@keel/check`, `@keel/testing`: a surrogate test in `clip`. Sizes measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text, docs. 2. `conformance-writer`: the two new files and the hygiene above, under `rfc:0222`. 3. Build:
- `packages/cli/src/internal/normalize.ts`: clip every `diag` record's message by the rule; `makeDiag.ts` uses the same function.
- `packages/check/src/internal/clip.ts`: the surrogate step; `packages/testing/src/testResults.ts`: the rule at 89 in place of 90.
- k.ledger: built (lane-t1, merged here); no build change.
- Messages: `packages/compiler/src/compile.ts` and `internal/clientReach.ts` (E1004: chain as a file list, the elision), `hosting/mountDiags.ts` and `hosting/mountSource.ts` (E1580, E1589 and its fix), `hosting/stylesProblems.ts` (E1587), `packages/check/src/internal/formatLiterals.ts` and `typeCheck.ts` (E1108 and its fix), the path shortening in the clip module of `@keel/compiler/internal`, `packages/check/src/internal/EXPLANATIONS.ts` (E1580, E1587, E1589, E1108 carry the remedies), and the unit tests pinning old texts (`packages/compiler/test/mountDiagnostics.test.ts`, `stylesProblems.test.ts`). Then: E1013 drops `; import it as '<relative>'` and front-shortens; E1730 (`packages/check/src/rules/identityMountMissing.ts`, its unit test `packages/check/test/identityMountMissing.test.ts:35`) takes the new text; E1011 in `packages/compiler/src/vite.ts` front-shortens the importer.
- `packages/check/package.json`: `@keel/router` in devDependencies.
- Docs: a changeset; `tasks/BACKLOG.md` 1080, 1085, 1091, 1092, 1023.
- The ledger: k.check#22, k.test-run#7, k.ledger#16 to #19 and std.sessions#18, #19 at `none` until covered (`ledger-fresh` lists them; the orchestrator regenerates).
