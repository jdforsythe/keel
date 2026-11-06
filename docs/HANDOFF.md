# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state: G1 and G2 passed (2026-11-06). golden app 1 is API-backed (apps/golden-1: web client + api node deployable; `node apps/golden-1/server.ts` on 4181, `vite preview --port 4180`); apps/inspector views a running app via /__keel/inspect; `keel inspect` summarizes it.
  - in flight: check mutation hardening; compiler/scaffold/cli mutation configs; evals/tasks/golden-1-api brief for the API-backed app.
  - next: 0033 domain skills; 0034 freeze review (G3): one-way audit, extension points exercised, status flips to conformance-covered; 0044; 0054 per-request stores; 0056 s.json; stdlib S1 sessions.
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0017 in docs/rfc; delegation tiers in docs/WORKFLOW.md; never Stryker inPlace.
  blockers: none
pending decisions: none
last updated: (initial)
```
