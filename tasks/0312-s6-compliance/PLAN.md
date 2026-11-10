# Task 0312: S6 Compliance (a11y pack, CSP, PII redaction, evidence bundle)

**Spec:** a11y pack (ui, testing), CSP (server), PII redaction (std-sessions, schema), evidence bundle (cli) · k.ui, k.server (kernel touch) · **Gate:** S6 exit: external a11y audit + pen test on golden app 3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S5 pushes

## Shape (tasks/PROGRAM.md)
1. [ ] Design RFC 0083 (one opus agent, no code), concurrent with the S2 batch (user decision D1).
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: golden app 3 built; the audit and pen test are external (user).

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 1: the design agent is writing `docs/rfc/0083-*.md`; read its report, then step 2.
