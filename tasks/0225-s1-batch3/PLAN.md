# Task 0225 + 0226 + 0227 + 0231 + leads: S1 batch 3

**Spec:** std.sessions (Ingest, API fingerprint, E2005) · k.store (lead 2) · **Gate:** S1 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-09)

## Deliverables
- [x] (agent A: archived entries `{ caller, bytes, session }`; past 5 per fingerprint the caller with most there loses its oldest; quota 1 MiB and 16 fingerprints per caller; past 64 or 4 MiB the largest share loses its oldest; list returns sessions only; routes budget 3 -> 3.5 kB, 3,529 B) 0225 ingest flood: sessions filed with the caller; eviction takes the caller holding the largest archive share first, per-caller quota; archive bytes tracked incrementally (no 4 MiB re-stringify per eviction step); residual (caller rotation) in docs/THREAT-MODEL.md
- [x] (agent A: error event `route`; hash over code, recorded data.at, route; ingest recomputes fingerprint and error) 0226 fingerprint spoofing: the fingerprint is recomputable from the session alone (error event carries the route id it fired under; hash over what the session holds); `sessions.ingest` always recomputes and never keeps a posted value
- [x] (agent B: sourcesOf yields literal import() specifiers; resolve maps .js/.jsx/.mjs and tries .tsx, /index.tsx; parseTs parses .tsx as tsx; three conformance cases) 0227 E2005 sees `await import(...)`, `.js` specifiers for `.ts`/`.tsx`, and `.tsx` re-exports
- [x] (agent B: dead-pid cleanup via kill(pid, 0); copies stay beside the fixtures since a tmpdir copy cannot resolve @keel/* through the workspace node_modules) 0231 `diskFixture()` removes copies of dead pids at start; copies live under os.tmpdir() if the runner still resolves packages there (else stay in place, documented)
- [x] (agent A: not deterministic; replay seeded only stores named in session.state, others kept earlier state; replay now seeds every live store, missing ones at `initial`; test/minimize-missing-store.test.ts) lead 1: minimizer determinism when stores are missing from `session.state` (test; fix if needed)
- [x] (agent C: not a bug; snapshot folds only the written copy, the live log keeps every entry; a restored store undoes only kept entries and undoWhere never matches a folded one; no secret or secret tx name in the JSON. Caveat: a reducer that copies `reveal(p.token)` into state writes the value into `state` and `initial`; pinned as current behaviour in packages/store/test/secretFold.test.ts; filed as a backlog line) lead 2: undo reach after a secret payload entry is folded into `initial`

## Steps
1. [x] PLAN; three agents in parallel: A (opus: rfc:0072, 0225, 0226, lead 1; std-sessions routes/record/fingerprint/replay, spec/std/sessions.md, apps/sessions, THREAT-MODEL); B (sonnet: 0227, 0231; std-sessions internal resolver, adapterNotNode, conformance E2005 and fixtures.ts); C (sonnet: lead 2; packages/store).
2. [x] Root `ok check 44 tasks` · `ok test 42 tasks` · `ok ledger --diff 465 items, 457 verified, 6 unsafe, 0 lowered, 0 uncovered` (E2001-E2004 clauses merged into one to keep the section under 1,500 tokens). Root `pnpm check`, `pnpm test`, `pnpm ledger --diff`; unsafe 6; budgets.
3. [ ] Reviewer approved with four wording fixes (applied). Red-team filed 0232-0238; 0232-0236, 0238 and the 0237 import-type false positive fixed in-batch (agents A, B resumed). Reviewer + red-team over the batch diff; findings to BACKLOG; in-batch fixes; commit `rfc:0072`; push.
4. [ ] Then 0095 (GitHub Action) as its own batch.

## Decisions
- D1: no write token for `sessions.ingest`: the recorder posts from browsers, so any token is public; the defence is eviction by caller share plus a per-caller quota, with caller rotation recorded as the residual (WORKFLOW RFC default 4, 6).
- D2: the fingerprint hashes what the session holds after redaction (code, `data.at` as recorded, the error event's route id), so client, server, replay and the Action compute the same value; `ingestFingerprint` keeps nothing posted. Replay records through the same recorder under the same config, so an honest session still reproduces.
- D4 (post red-team, 0232/0233): caller-based eviction and quota removed. A cookieless POST mints a fresh caller and ingest is this service's only write, so the caller is free to mint and worthless as a quota key; eviction returns to oldest `last`, newest 5 per fingerprint. Incremental byte accounting and the recomputed fingerprint stay. Anonymous ingest is one bounded buffer; rate limiting in front of the service is the operator's defence (THREAT-MODEL). 0234: replay binds the project's std config so redaction matches the live recorder. 0235: only masked values are scrubbed from error data. 0236: the 256 KiB bound applies to the stored session.
- D3: file ownership: A owns `packages/std-sessions/src/**` except `src/internal/{reachesSource,sourcesOf,parseTs}.ts` and `src/adapterNotNode.ts` (B); A owns conformance files for its clauses; B owns `conformance/fixtures.ts` and `conformance/E2005-*.test.ts`; C owns `packages/store/**`. Shared files (spec/00-map.md, budgets.json, ledger.json, BACKLOG, HANDOFF) are the orchestrator's.

## Verification
- [ ] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [ ] std.sessions every clause cited and green, status stays conformance-covered; new clauses (caller eviction, recomputed fingerprint) covered

## Next action
Read the reviewer and red-team reports; apply in-batch fixes; flip backlog 0225-0227, 0231; file the store state-level secret caveat (lead 2) as a backlog line; final commit rfc:0072; push; then 0095.
