# Task 0312: S6 Compliance (a11y pack, CSP, PII redaction, evidence bundle)

**Spec:** a11y pack (ui, testing), CSP (server), PII redaction (std-sessions, schema), evidence bundle (cli) · k.ui, k.server (kernel touch) · **Gate:** S6 exit: external a11y audit + pen test on golden app 3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S5 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0083 `docs/rfc/0083-s6-compliance.md` (draft 416b9ec); reconciling with the accepted 0082 and writing ADRs 0092-0096.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
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
Step 1: the design agent is writing `docs/rfc/0083-*.md`; read its report, then step 2.
