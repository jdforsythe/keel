# Task 0125-0128: red-team 2026-11-07 mediums, batch 2

**Spec:** k.server (0125, 0127) · k.router (0126) · k.runtime (0128) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0125 (agent A done: storage first, memory after resolve; per-key inOrder chain; reads wait for in-flight saves; not atomic across keys) `saveStores` commits in-memory state only after `ctx.storage.set` resolves; a rejected save leaves memory unchanged; concurrent saves serialize (server)
- [x] 0126 (agent B done: rfc:0051, ADR-0040, E1508 in k.router for client router, server and check; in-process hop walk, cap 8, cycle by location → 500 at the denying level + dev diag; `next` carried innermost, same-origin paths only; static rule for literal redirects into the guard's own chain, no fix; k.router ~1,493 tokens) guard redirect loops: server hop cap (one bounded redirect chain per request, `next` not nested), and a check rule for a guard redirecting into its own guarded subtree if statically visible (router, server, check); rfc:0051 if a new clause or code is needed
- [x] 0127 (agent A done: throws only under NODE_ENV=production with mode production and no assets) production `createApp` without `assets` is E1555 at startup instead of serving the dev entry to island pages (server)
- [x] 0128 (agent C done: ServerNode gains no-op add/removeEventListener; runtime-dom untouched; child-process test both orders) importing `@keel/ui` / `@keel/runtime-dom/ops` after `installServerDom` works: the server document supports the listeners the runtime registers at import (runtime-dom, server)

## Steps
1. [x] PLAN; three agents done; agent A on rfc:0052 (k.server E1555 clause) and diagLine `see` by code block; in parallel: A server (0125, 0127: saveStores.ts, createApp.ts, loadAssets.ts, BuiltClient.ts); B 0126 (router, check, server runGuards.ts/handle.ts redirect path only); C 0128 (runtime-dom, server dom/ only).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 394 items, 349 verified, 6 unsafe, 0 lowered, 0 uncovered`; rfc:0052 (ADR-0041) k.server E1555 clause + conformance; seeOf for diag `see`. Reviewer + red-team running.
3. [x] 0145/0146/0147 fixed in-batch; final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 394 items, 349 verified, 6 unsafe, 0 lowered, 0 uncovered`; commit by path (rfc:0051 if used), flip backlog, handoff, push.

## Decisions
- D1: Server files are split by ownership across agents A, B, C (listed in step 1); any agent needing a file outside its list reports instead of editing.
- D2: RFC number 0051 is reserved for 0126 if a spec clause or code is needed; the other items are bug fixes under existing clauses.

- D4: red-team batch 2 filed 0145-0148; 0145 (tab/LF open redirect in `next`), 0146 (quadratic nested `next`) and 0147 (E1555 skipped when NODE_ENV unset) are fixed in-batch; 0148 (409 check ignores read-only stores; per-key loads can mix old and new keys) is a store-consistency design item for batch 3.
- D5: E1555 gate is mode production + no `assets` + NODE_ENV not `development`/`test` (unset counts as production); rfc:0052 clause amended.
- D3: 0127 E1555 applies to every production deployable without `assets`, island-free or not: islands are only known at render time and `keel build` emits assets for every node deployable. The k.server Build sentence ("dev or no `assets` serves `/@keel/entry.ts`") is amended under NODE_ENV=production via rfc:0052 after agent B's k.server edits land (one clause, one conformance test).

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro is a failing-then-passing test

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1386 files` · `ok budgets 46 measured` · `ok ledger --diff 394 items, 349 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 3: 0129-0131, 0139, 0143, 0144, 0148.