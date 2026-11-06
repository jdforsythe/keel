# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - task 0096 mutation (tasks/0096-mutation/PLAN.md), branch jdforsythe/test-impl in this worktree: subagents writing packages/{compiler,cli}/test/mutation-*.test.ts and tuning scaffold stryker; orchestrator reruns mutate per package sequentially after they finish.
  - state (end of 2026-11-06): G1 and G2 passed. All 15 kernel sections implemented; 5 of 18 conformance-covered (docs/freeze-review.md). Red-team report docs/red-team/2026-11-06.md: critical and high items fixed (RFC 0022 server hardening, RFC 0023 check static-only, schema nested proto keys); remaining items in tasks/BACKLOG.md "## Red team" (0071, 0073, 0078-0090 open). S1 sessions spec drafted (spec/std/std.sessions.md; backlog 0091-0095).
  - root `pnpm check` and `pnpm test` green (31 tasks). Mutation: all packages at threshold except compiler 57.4%, cli 59.1%, scaffold unmeasured (0096).
  - running for the user: `NODE_ENV=production node apps/golden-1/server.ts` (4181) and `vite preview --port 4180` (apps/golden-1); open http://localhost:4180/ with `open`.
  - next (pick the first unchecked unblocked line in BACKLOG): 0096 mutation gaps; red-team 0071/0073/0078-0090 (0054 per-request stores design); 0091 sessions conformance then 0092 module; 0057-0065 freeze gaps; 0044; 0069.
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0023 in docs/rfc; delegation tiers in docs/WORKFLOW.md; never Stryker inPlace; shared git index means agents must stage by explicit path.
  blockers: none
pending decisions: none
last updated: (initial)
```
