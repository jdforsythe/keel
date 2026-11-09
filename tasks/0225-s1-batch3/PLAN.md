# Task 0225 + 0226 + 0227 + 0231 + leads: S1 batch 3

**Spec:** std.sessions (Ingest, API fingerprint, E2005) · k.store (lead 2) · **Gate:** S1 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-09)

## Deliverables
- [ ] 0225 ingest flood: sessions filed with the caller; eviction takes the caller holding the largest archive share first, per-caller quota; archive bytes tracked incrementally (no 4 MiB re-stringify per eviction step); residual (caller rotation) in docs/THREAT-MODEL.md
- [ ] 0226 fingerprint spoofing: the fingerprint is recomputable from the session alone (error event carries the route id it fired under; hash over what the session holds); `sessions.ingest` always recomputes and never keeps a posted value
- [ ] 0227 E2005 sees `await import(...)`, `.js` specifiers for `.ts`/`.tsx`, and `.tsx` re-exports
- [ ] 0231 `diskFixture()` removes copies of dead pids at start; copies live under os.tmpdir() if the runner still resolves packages there (else stay in place, documented)
- [ ] lead 1: minimizer determinism when stores are missing from `session.state` (test; fix if needed)
- [x] (agent C: not a bug; snapshot folds only the written copy, the live log keeps every entry; a restored store undoes only kept entries and undoWhere never matches a folded one; no secret or secret tx name in the JSON. Caveat: a reducer that copies `reveal(p.token)` into state writes the value into `state` and `initial`; pinned as current behaviour in packages/store/test/secretFold.test.ts; filed as a backlog line) lead 2: undo reach after a secret payload entry is folded into `initial`

## Steps
1. [ ] PLAN; three agents in parallel: A (opus: rfc:0072, 0225, 0226, lead 1; std-sessions routes/record/fingerprint/replay, spec/std/sessions.md, apps/sessions, THREAT-MODEL); B (sonnet: 0227, 0231; std-sessions internal resolver, adapterNotNode, conformance E2005 and fixtures.ts); C (sonnet: lead 2; packages/store).
2. [ ] Root `pnpm check`, `pnpm test`, `pnpm ledger --diff`; unsafe 6; budgets.
3. [ ] Reviewer + red-team over the batch diff; findings to BACKLOG; in-batch fixes; commit `rfc:0072`; push.
4. [ ] Then 0095 (GitHub Action) as its own batch.

## Decisions
- D1: no write token for `sessions.ingest`: the recorder posts from browsers, so any token is public; the defence is eviction by caller share plus a per-caller quota, with caller rotation recorded as the residual (WORKFLOW RFC default 4, 6).
- D2: the fingerprint hashes what the session holds after redaction (code, `data.at` as recorded, the error event's route id), so client, server, replay and the Action compute the same value; `ingestFingerprint` keeps nothing posted. Replay records through the same recorder under the same config, so an honest session still reproduces.
- D3: file ownership: A owns `packages/std-sessions/src/**` except `src/internal/{reachesSource,sourcesOf,parseTs}.ts` and `src/adapterNotNode.ts` (B); A owns conformance files for its clauses; B owns `conformance/fixtures.ts` and `conformance/E2005-*.test.ts`; C owns `packages/store/**`. Shared files (spec/00-map.md, budgets.json, ledger.json, BACKLOG, HANDOFF) are the orchestrator's.

## Verification
- [ ] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [ ] std.sessions every clause cited and green, status stays conformance-covered; new clauses (caller eviction, recomputed fingerprint) covered

## Next action
Wait for agents A, B, C; integrate; run root checks; reviewer + red-team.
