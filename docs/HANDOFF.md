# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state (end of 2026-11-06): G1 and G2 passed. All 15 kernel sections implemented; 18 of 18 kernel sections conformance-covered after RFCs 0032-0041 (std.sessions still proposed). Red-team report docs/red-team/2026-11-06.md: critical and high items fixed (RFC 0022 server hardening, RFC 0023 check static-only, schema nested proto keys); red-team batch 2 closed 2026-11-06 (0071, 0073, 0078-0081, 0083, 0084, 0089); batch 3 closed (0082, 0085-0088, 0090; RFCs 0024-0026); batch 4 closed (RFCs 0027-0031: loader/action declarations, typed tx + log meta, closed objects + member unions, compiler codes + a11y roles, services check rules); batches 5-6 closed (RFCs 0032-0041: conformance completion, rules triage, router guards by reference + routes.href); follow-ups 0102, 0109, 0111-0114; 0098 check mutation still unmeasured (KERNEL_RULES.ts re-included; run when the tree is quiet). S1 sessions spec drafted (spec/std/std.sessions.md; backlog 0091-0095).
  - root `pnpm check` and `pnpm test` green (31 tasks). Mutation: all 15 packages at threshold (0096 closed 2026-11-06: compiler 88.2%, cli 90.9%, scaffold 71.0%); scaffold survivors and run time are 0097. Remote: https://github.com/jdforsythe/keel (branch jdforsythe/test-impl; main seeded from it).
  - running for the user: `NODE_ENV=production node apps/golden-1/server.ts` (4181) and `vite preview --port 4180` (apps/golden-1); open http://localhost:4180/ with `open`.
  - next (pick the first unchecked unblocked line in BACKLOG): red-team 0071/0073/0078-0090 (0054 per-request stores design); 0091 sessions conformance then 0092 module; 0057-0065 freeze gaps; 0044; 0069.
  - budgets: tooling/budgets.json now covers all 15 package sizes (esbuild bundle), real `keel check` on tooling/fixtures/injected10-app, explain, spec --for, mcp tools/list (no outputSchema; compact fix hunks drop `---/+++` headers). Ledger: `pnpm ledger` is `keel ledger --write` (tooling/ledger.mjs deleted); AST-based evidence. Hooks: .githooks/commit-msg + tooling/conformance-guard.mjs (S0008) in `pnpm check`; `mutate-pr` CI job via tooling/mutate-changed.mjs.
  - process: tests never call process.chdir (Stryker workers refuse it; spy process.cwd); scaffold Stryker tuning keys on STRYKER_MUTATOR_WORKER; rfc:0000 pre-implementation fixes; RFCs 0001-0023 in docs/rfc; delegation tiers in docs/WORKFLOW.md; never Stryker inPlace; shared git index means agents must stage by explicit path.
  blockers: none
pending decisions: none
last updated: 2026-11-06 (red-team batches 2-3, RFCs 0024-0041; all kernel sections conformance-covered)
```
