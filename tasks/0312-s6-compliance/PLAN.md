# Task 0312: S6 Compliance (a11y pack, CSP, PII redaction, evidence bundle)

**Spec:** a11y pack (ui, testing), CSP (server), PII redaction (std-sessions, schema), evidence bundle (cli) · k.ui, k.server (kernel touch) · **Gate:** S6 exit: external a11y audit + pen test on golden app 3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open; implementation started 2026-11-13 (S5 pushed)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0083 `docs/rfc/0083-s6-compliance.md` accepted (ADR-0092 to ADR-0096; rebased on 0082).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
2a. [~] Orchestrator prep: spec written in (D6); still to do: package exports, axe-core move, budgets, docs prep, `pnpm install`.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: golden app 3 built; the audit and pen test are external (user).

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

- D2 (user, 2026-11-10): API shapes accepted as a set (axe-core in the harness plus token contrast, `autocomplete`, `focusOrder()`, focus to h1/main after navigation, one fixed CSP with nonce and Trusted Types, six headers, HSTS, self-hosted report endpoint, E1570/E1571, `.pii(class)` with 8 classes and E1111, `keel evidence` Ed25519-signed with `--verify`).
- D3 (user, 2026-11-10): session `redact` KEEPS the `tx:`/`store:`/`route:` prefixes; the RFC's fail-closed change to them is rejected.
- D4 (user, 2026-11-10): integrations approved: no third-party CSP collector, CI-supplied `pnpm audit` output, Ed25519 (no Sigstore), `csp.txt` for client and static builds. Audit and pen-test firms are the user's choice.
- D5 (user, 2026-11-10): brand token `textSecondary` darkens to #6B6B74 and docs/BRAND.md states the measured ratios.
- D6 (orchestrator, 2026-11-13; confirm or reverse): RFC 0083's spec text is written into `spec/` rebased on the tree after S5. Tokens: k.a11y 1,337, k.security 1,199, k.privacy 1,011, k.evidence 1,071, k.ui 1,403, k.schema 1,268, k.server 1,442, k.testing 1,094, k.ledger 1,473, k.head 786, k.cli 1,500, std.sessions 1,500 (both at the cap: the next change splits k.cli at Inspect, std.sessions at Ingest), map 1,198. Renumbering: k.schema#10 (secret) is k.privacy#1 and #11-#13 are #10-#12; k.server#12 (cookie) is k.security#8 and #13-#16 are #12-#15; k.head#6 is new. Differences from the RFC's text: (1) k.a11y Required props holds the `Box` `nav`/`aside` `label` text and E1802; (2) axe-core runs the WCAG tags plus `landmark-unique`, so the landed E1703 behaviour stays; (3) `renderRoute` renders its document (`<html lang>`, `<title>`, the chain inside `main`): the a11y lane builds it; (4) `csp.txt`'s `connect-src` adds each `keel-peer` origin; (5) a `client` `index.html` served by a `node` host carries the `csp.txt` policy, not the nonce policy; (6) the input mask covers one-character `keydown` keys; (7) the ledger file gains an `a11y` key so `--diff` can compare claims; (8) k.cli, std.sessions and the map were tightened in wording to fit. All codes the RFC takes were free. Noted: E1571 and E1567 can both fire on one `service({ base: '<literal>' })`.
- Conformance headers to move in an `rfc:0083` commit: `packages/schema/conformance/secret.test.ts` (k.privacy), `packages/server/conformance/caller-cookie-host-prefix.test.ts` (k.security), `packages/ui/conformance/box-label-0091.test.ts`, `rules-e1801-e1802-types.test.ts`, `rules-e1804-contrast.test.ts` (k.a11y). Until then `keel ledger --diff` shows k.schema#10 lowered and k.head#6 uncovered.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 2a: prep agent (axe-core 4.14.0 from `packages/ui` dev to `packages/testing` dependencies; `./a11y` export in testing, `./csp` in server, `./evidence` in cli; `reports/` in `.gitignore`; budgets per RFC Token impact; one `pnpm install`) and docs prep (A11Y-TARGET sentence, BRAND rows and the lockup colour per D5, THREAT-MODEL lines, ARCHITECTURE rows, OUTPUT kinds). Step 3: conformance-writers per lane from RFC 0083 "Conformance diff" (kernel: k.privacy, k.security check and runtime-dom files, k.head; a11y: k.a11y; server: k.security; sessions: redaction property; evidence: k.evidence; plus the five header moves). Step 4: lanes per the RFC's Lanes table, kernel first.
