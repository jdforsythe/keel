# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state: all 15 kernel sections implemented (k.server WIP-committed 5bab51d, review pending; k.module checks implementer running). golden app 1 runs in a browser (port 4180). RFCs 0001-0016 landed.
  - in flight: server fixture type fix (rfc:0000) + router/server alignment (next param, keel.fields messages); 0030 module checks; mutation-score survey.
  - next: review server, flip k.server; re-run real-model eval baseline (last run: converged=false only because of a stale ledger baseline, now fixed); 0032 golden-1 real API through services+server; E1206 explain entry; 0031 inspector; G2 gate.
  - process: rfc:0000 pre-implementation fixes; delegation tiers in docs/WORKFLOW.md; cli last in deps order.
  blockers: none
pending decisions: none
last updated: (initial)
```
