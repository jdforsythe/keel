# Task 0092: @keel/std-sessions (S1 batch 1)

**Spec:** std.sessions · k.ctx k.store k.testing k.cli k.router (rfc:0070 additions) · **Gate:** S1 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-09)

## Decisions (user, 2026-11-09)
- D1: `keel session replay|minimize|to-test` run app code through the project's `keel test` runner (one way to load app code).
- D2: guards receive the caller (k.router change); the sessions reader list stays server-only config, not client-readable.
- D3: recording on by default; `to-test` and the Action redact every string field unless a schema marks it public (opt-in exposure); passwords and `s.secret` always redacted.
- D4: the six kernel additions are accepted as one RFC (0070): k.ctx `observe(ctx, fn)`, `seedOf(ctx)`, reactive `stores()`, store `payloads`, harness `navigate(href)`, k.cli `stdCommand`, plus importDeps `./tools` loading.
- D5: `record` is a no-op on the server.
- D6 (0194): the `@keel/std-*` name gate is the trust boundary (same as the project's own deps); no prompt; closed.
- D7 (0034): freeze stays held.

- D8 (2026-11-09, orchestrator): stdlib rules need sibling files, so rfc:0070 also adds k.check `RuleInput.project: readonly SourceFile[]` (the project's compiled code files plus topology.ts, read-only, shared by reference); K owns packages/check for it, R adds the clause, S writes E2001/E2005 as pure functions over (file, project) and wires them when K lands.

- D9 (2026-11-09, from S's implementation): redaction entries cover both `tx:` and `el:` forms; overflow with no `nav` keeps an appended input event and rebases to now; `nav.href` is a string in the Session schema; `Session.at` is new; fixtures build the store in `scope()` and the component from @keel/ui; replay matches hrefs through `@keel/router/internal`; kernel-synthetic focus (router navigation, resume restore) is not a user `fire`; `clientStd(pkg, keys)` exposes only the named keys (`redact`, never `readers`). R folds 1-6 into the RFC and spec; K implements the last two.

## Deliverables
- [x] (agent R done; tokens: std.sessions 1,499, k.ctx 1,465, k.store 1,442, k.testing 1,498, k.cli 1,499, k.router 1,500, k.module 1,500, k.check 1,340; 15 std.sessions clauses; kernel clauses appended last; D3 marker = server-only `expose: string[]`) RFC 0070 + ADR-0059 amended with D1-D5, status accepted; spec diffs applied (std.sessions ≤ 1,500 tokens; k.ctx, k.store, k.testing, k.cli, k.router each ≤ 1,500)
- [x] (agent K done: observe/seedOf/CtxEvent with password masking and quiet() for kernel focus; reactive stores() and Store.payloads; guards get { url, caller }, renderRoute caller; harness navigate; stdCommand, Io.fetch, ./tools loading, clientStd keys; RuleInput.project frozen per project; runtime-dom 3,938 B; router budget 8 → 8.5 kB (8,376 B, D7); forms form.ts touched for quiet()) kernel additions implemented with conformance per section (rfc:0070)
- [x] (agent S done: `record`, `replay`, `redact`, `redactSession`, `session`, `./tools` (E2001, E2005, formatter), `./module`; clauses 1-4, 9, 10, 11, 15 green, 5-8 and 12-14 skipped for 0093/0094; 5,845 B of a 6 kB budget; replay uses @keel/router/internal) @keel/std-sessions: manifest, `session` capability (real/shell/sim), `record`, redaction, `replay`, `session` formatter, E2001/E2005 rules, config registered server-only + `redact` client-readable; the 0091 suite unskipped and green
- [x] budgets (47 measured; router 8.5 kB, std-sessions 6 kB), ledger (std.sessions 1-4, 9-11, 15 proven; 5-8, 12-14 are 0093/0094), changesets (rfc-0070-kernel-additions, std-sessions-0092)

## Steps
1. [x] PLAN; three agents in parallel: R (RFC/ADR/spec), K (kernel: ctx, store, testing, cli, router, compiler importDeps), S (packages/std-sessions). Signatures are pinned by RFC 0070's TypeScript blocks; S codes against them and integrates when K lands.
2. [x] R trimmed k.cli to 1,493 under the cli counter (and k.router, k.module, k.testing, std.sessions); root `ok check 42 tasks` · `ok test 40 tasks` · `ok ledger --diff 459 items, 447 verified, 6 unsafe, 0 lowered, 0 uncovered`. Reviewer + red-team running.
3. [x] Final `ok check 42 tasks` · `ok test 40 tasks` · `ok ledger --diff 459 items, 447 verified, 6 unsafe, 0 lowered, 0 uncovered`; one commit tagged rfc:0070; 0092 and the in-batch red-team lines flipped; next 0093-0095 with follow-ups 0205, 0211, 0212, 0214-0216, 0218.

- D10: reviewer approved. Red-team 2026-11-09 filed 0206-0218; in-batch: S fixes 0206 (el: entries cover every event kind), 0207 redaction side, 0208 (secret search values in nav), 0209 (error messages scrubbed of matched values), 0210 (overflow keeps the triggering error), seed absent when unseeded; K fixes 0207 (fields ever password stay masked), 0213 (seedOf undefined when unseeded), 0217 (clientStd key merging); R amends the clauses. Follow-ups: 0211 (session size bound), 0212 (no nav on node/static; pre-resume inputs), 0214 (record wildcard), 0215 (E2005 re-exports), 0216 (observe as a declared capability), 0218 (router internal contract).

- D11: `reproduced` keeps its meaning (fingerprints match); an unseeded session replays under seed 0 with "state may differ" noted and `deterministic: false`, so the Action can still triage real browser sessions (R's reading, accepted by the orchestrator).

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] std.sessions clauses 1-4, 9-11, 15 green and cited; 5-8, 12-14 skipped for 0093/0094; status flips to `implemented` (or `conformance-covered` if every clause is cited and green)

## Trailer
`ok check 42 tasks` · `ok test 40 tasks` · `ok voice-lint 1585 files` · `ok budgets 47 measured` · `ok ledger --diff 459 items, 447 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. S1 batch 2: 0093 ingest service + 0094 `keel session` commands (clauses 5-8, 12-14), then 0095 Action; follow-ups 0205, 0211, 0212, 0214-0216, 0218 ride along where the owner matches.