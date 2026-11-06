# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state (2026-11-06 late): 15 of 15 kernel sections implemented except k.server (implementer running) and k.module (conformance being written). golden app 1 runs in a browser (http://localhost:4180 via `vite preview`; tooling/smoke); Suggestions served by a dev stub until 0032.
  - mutation: schema 92.1%, reactive 87.5%, services 75.9%; survey of the rest running.
  - in flight: eval baseline (real model, isolated worktree), 0028 server, k.module conformance, RFC 0012 clock.after (ctx+services), RFC 0013 api.input, RFC 0014 Scope.run (reactive+runtime-dom), RFC 0015 settle() (testing).
  - next: review server; 0032 golden-1 real API via services+server; 0030 module check; 0031 inspector; 0050 ctx random.id; 0044 (G3); G1 gate review then G2 gate.
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0015 in docs/rfc; delegation tiers in docs/WORKFLOW.md.
  blockers: none
pending decisions: none
last updated: (initial)
```
