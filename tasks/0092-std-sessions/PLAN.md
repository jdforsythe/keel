# Task 0092: @keel/std-sessions (S1 batch 1)

**Spec:** std.sessions · k.ctx k.store k.testing k.cli k.router (rfc:0070 additions) · **Gate:** S1 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-09)

## Decisions (user, 2026-11-09)
- D1: `keel session replay|minimize|to-test` run app code through the project's `keel test` runner (one way to load app code).
- D2: guards receive the caller (k.router change); the sessions reader list stays server-only config, not client-readable.
- D3: recording on by default; `to-test` and the Action redact every string field unless a schema marks it public (opt-in exposure); passwords and `s.secret` always redacted.
- D4: the six kernel additions are accepted as one RFC (0070): k.ctx `observe(ctx, fn)`, `seedOf(ctx)`, reactive `stores()`, store `payloads`, harness `navigate(href)`, k.cli `stdCommand`, plus importDeps `./tools` loading.
- D5: `record` is a no-op on the server.
- D6 (0194): the `@keel/std-*` name gate is the trust boundary (same as the project's own deps); no prompt; closed.
- D7 (0034): freeze stays held.

## Deliverables
- [ ] RFC 0070 + ADR-0059 amended with D1-D5, status accepted; spec diffs applied (std.sessions ≤ 1,500 tokens; k.ctx, k.store, k.testing, k.cli, k.router each ≤ 1,500)
- [ ] kernel additions implemented with conformance per section (rfc:0070)
- [ ] @keel/std-sessions: manifest, `session` capability (real/shell/sim), `record`, redaction, `replay`, `session` formatter, E2001/E2005 rules, config registered server-only + `redact` client-readable; the 0091 suite unskipped and green
- [ ] budgets, ledger (std.sessions clauses above `none`), changesets

## Steps
1. [x] PLAN; three agents in parallel: R (RFC/ADR/spec), K (kernel: ctx, store, testing, cli, router, compiler importDeps), S (packages/std-sessions). Signatures are pinned by RFC 0070's TypeScript blocks; S codes against them and integrates when K lands.
2. [ ] Root check/test/ledger; reviewer + red-team; in-batch fixes.
3. [ ] Commit by path (rfc:0070), flip 0092, handoff, push. Then 0093-0095.

## Verification
- [ ] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [ ] std.sessions conformance green; status flips to `implemented` (or `conformance-covered` if every clause is cited and green)

## Next action
Wait for agents R, K, S; step 2.
