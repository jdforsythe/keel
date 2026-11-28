# Task 0190 + follow-ups + 0091: batch 9

**Spec:** k.testing (0190) · k.router (0191) · k.ui k.check (0188) · k.module (0189) · std.sessions (0091) · **Gate:** G3 (0189, 0091 feed S1) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0190 (agent A done: golden-1 5/5 raised, 2 probabilistic; golden-2 21/21 raised, 3 probabilistic; golden-1-api and golden-2 evals converged=true with --runner none; board.test.ts imports routes.ts first) golden-1's five `none` exports and golden-2's 21 reach rung `example` through @keel/testing renders; golden-1-api eval ledger acceptance passes with `--runner none` (apps, evals)
- [x] 0191 (agent B done: a verb value must be `{ kind: "keel.action", run }`, else E1505 with the cycle hint when undefined, atomic; exposes golden-1 board.test.ts import cycle → routed to agent A) `routes.actions` reports E1505 when an action value is not a function (router)
- [x] 0188 (agent C done: rfc:0069, ADR-0058; E1808 in the k.ui block on a base element call with an eager `children` (element call, JSX, array, ?:, &&, same-file const), callee resolved through globalRefs, thunk fix; misses component calls and xs.map children, documented; check budget 30 → 31 kB, 31,191 B, D7) check rule flags an eager element child of a base element with a thunk fix (check, ui)
- [x] 0189 (agent C: `#k-state` carries `std` for island pages and RESUME_ENTRY calls bindClientStd before resume; client deployables embed the build's std data in entryCode; THREAT-MODEL notes std config is public) the client entry binds `.keel/std.json` so `stdConfig` works in client deployables (compiler, server)
- [x] 0091 (agent D done: packages/std-sessions skeleton with placeholders throwing "not implemented (backlog 0092)"; 34 skipped tests in 14 files citing all 9 clauses at rung none; 11 spec gaps listed for the 0092 RFC; pnpm-lock.yaml +25 lines) std.sessions conformance suite from spec/std/std.sessions.md by the conformance-writer (tests only; red until 0092)

## Steps
1. [x] PLAN; agents in parallel: A 0190 (apps tests, evals); B 0191 (router); C 0188 + 0189 (check rule, ui doc, compiler client entry, server); D 0091 (conformance-writer: packages/std-sessions/conformance, tests may be red).
2. [x] Root `ok check 42 tasks` · `ok test 40 tasks` · `ok ledger --diff 439 items, 422 verified, 6 unsafe, 0 lowered, 0 uncovered` (stale apps/.injected10-conf-* from an interrupted cli test removed after checking its age and contents). Reviewer + red-team running.
3. [x] 0199-0203 fixed in-batch; one lint nit fixed by the orchestrator (eagerChild.test.ts template literal); a 12-hour orphan vitest worker (pid 31603, 99% CPU) killed and two stale apps/.injected10-conf-* dirs removed (backlog 0204); final `ok check 42 tasks` · `ok test 40 tasks` · `ok ledger --diff 439 items, 422 verified, 6 unsafe, 0 lowered, 0 uncovered` (ListsPage and BoxShell honestly example: accepted correction) · golden-1-api and golden-2 evals converged=true; one commit tagged rfc:0069 rfc:0063; 0097 rerun started alone after the push.

## Decisions
- D1: Ownership: A apps/golden-1/test, apps/golden-2/test, evals; B packages/router; C packages/check src/rules + conformance for its clause, packages/ui README/doc only, packages/compiler client entry (`src/internal/entryCode.ts` or equivalent) + `src/std/**`, packages/server only if the std artifact path for clients needs it; D packages/std-sessions/conformance only (new package dir with package.json and vitest config so tests run; `pnpm test` must stay green: the suite is marked `describe.todo`/`it.skip` with the clause names until 0092 lands, per docs/TESTING.md if it allows, else the package is left out of the turbo test task until 0092).
- D2: 0091 tests are written red-first and skipped at the suite level with one `// TODO 0092` line, so the ledger lists the clauses as `none` and `pnpm test` stays green.

- D3: reviewer approved (std-sessions changeset added). Red-team batch 9 filed 0199-0203; in-batch fixes: 0199 and 0201 agent C (done: `clientStd(pkg)` opt-in next to s.register, server-only by default; `#k-state` and the client entry carry only opted-in packages for the served deployable's modules; E1808 covers For/If/Match children, destructured namespace, const props object; check 31,402 B); 0200 (action shape validation incomplete) agent B (done: kind, run, input.parse/decodeStrings/node, stores; own data descriptors only so Proxies cannot fake it; router trimmed back under 8 kB); 0202 (three vacuous golden tests; a probabilistic → example drop there is a correction and is accepted) agent A; 0203 (SessionsConfig unregistered) agent D (done: registered at import, TODO 0092 client: true).

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] golden-1-api and golden-2 `pnpm eval --runner none` converged=true
- [ ] 0097: the sandboxed run failed in the dry run (brand test resolved docs/brand against the Stryker sandbox cwd; fixed with a repoRoot() walk to pnpm-workspace.yaml); the unsandboxed rerun hung with an empty log for 25 minutes while four agents ran tests; rerun alone after this batch's push with nothing else running

## Trailer
`ok check 42 tasks` · `ok test 40 tasks` · `ok voice-lint 1517 files` · `ok budgets 46 measured` · `ok ledger --diff 439 items, 422 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered` · `ok eval golden-1-api converged=true` · `ok eval golden-2 converged=true`

## Next action
None; closed. 0097 running alone; then S1 sessions 0092 (RFC with the 11 spec gaps from 0091), 0204; 0194 awaits a human decision.