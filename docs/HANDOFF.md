# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state: all 15 kernel sections implemented; k.module checks (0030) and server (0028) reviewed; golden app 1 runs in a browser (port 4180, dev stub for /api/suggestions being replaced by the real API, 0032 in flight). Root check/test green at HEAD; local eval converges.
  - mutation: schema 92.1, reactive 87.5, store 89.3, router 89.5, runtime-dom 75.6, forms 93.7, testing 88.1, services 75.9, server 88.6, ctx 83.0, ui 70.3; check in progress (was 35.5); compiler/scaffold/cli config fixes in flight. Never use Stryker inPlace (rewrites tracked files).
  - in flight: real-model eval baseline run 3 (runs 1-2 failed only on the ledger gate, now scoped to the app); check mutation; compiler/scaffold/cli mutation configs; 0032 real API.
  - next: 0031 inspector; 0044 (G3); G2 gate review; stdlib waves.
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0016 in docs/rfc; delegation tiers in docs/WORKFLOW.md.
  blockers: none
pending decisions: none
last updated: (initial)
```
