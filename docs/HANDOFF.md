# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state: G1 passed (baseline run 3 converged iter=1). All 15 kernel sections implemented and reviewed. golden app 1 (0027) + real API (0032) done: `node apps/golden-1/server.ts` on 4181, `vite preview --port 4180` proxies /api; verified in headless Chromium (tooling/smoke).
  - in flight: 0031 inspector viewer (RFC 0017), check mutation hardening, compiler/scaffold/cli mutation configs.
  - next: G2 gate review once 0031 lands; 0033 domain skills; 0034 freeze review (G3); 0044 guards-by-reference RFC; stdlib waves.
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0017 in docs/rfc; delegation tiers in docs/WORKFLOW.md; never Stryker inPlace.
  blockers: none
pending decisions: none
last updated: (initial)
```
