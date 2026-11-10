# Task 0312: S6 Compliance (a11y pack, CSP, PII redaction, evidence bundle)

**Spec:** a11y pack (ui, testing), CSP (server), PII redaction (std-sessions, schema), evidence bundle (cli) · k.ui, k.server (kernel touch) · **Gate:** S6 exit: external a11y audit + pen test on golden app 3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S5 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0083 `docs/rfc/0083-s6-compliance.md` accepted (ADR-0092 to ADR-0096; rebased on 0082).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: golden app 3 built; the audit and pen test are external (user).

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

- D2 (user, 2026-11-10): API shapes accepted as a set (axe-core in the harness plus token contrast, `autocomplete`, `focusOrder()`, focus to h1/main after navigation, one fixed CSP with nonce and Trusted Types, six headers, HSTS, self-hosted report endpoint, E1570/E1571, `.pii(class)` with 8 classes and E1111, `keel evidence` Ed25519-signed with `--verify`).
- D3 (user, 2026-11-10): session `redact` KEEPS the `tx:`/`store:`/`route:` prefixes; the RFC's fail-closed change to them is rejected.
- D4 (user, 2026-11-10): integrations approved: no third-party CSP collector, CI-supplied `pnpm audit` output, Ed25519 (no Sigstore), `csp.txt` for client and static builds. Audit and pen-test firms are the user's choice.
- D5 (user, 2026-11-10): brand token `textSecondary` darkens to #6B6B74 and docs/BRAND.md states the measured ratios.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Waits for the S2-S5 pushes. Then: orchestrator prep per RFC 0083 "Lanes" (new sections k.a11y, k.security, k.privacy, k.evidence; edits to k.ui, k.schema, k.server, k.head, k.testing, k.ledger, k.cli, std.sessions; BRAND.md measured ratios and the lockup colour; A11Y-TARGET.md sentence; skeletons; deps; budgets), conformance-writers, implementation batch (kernel + a11y, server, sessions, evidence, golden-3 lanes); external audit and pen test are the user's to book.
