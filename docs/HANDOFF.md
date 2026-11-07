# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - state (end of 2026-11-06): G1 and G2 passed. All 15 kernel sections implemented; 5 of 18 conformance-covered (docs/freeze-review.md). Red-team report docs/red-team/2026-11-06.md: critical and high items fixed (RFC 0022 server hardening, RFC 0023 check static-only, schema nested proto keys); remaining items in tasks/BACKLOG.md "## Red team" (0071, 0073, 0078-0090 open). S1 sessions spec drafted (spec/std/std.sessions.md; backlog 0091-0095).
  - root `pnpm check` and `pnpm test` green (31 tasks). Mutation: all 15 packages at threshold (0096 closed 2026-11-06: compiler 88.2%, cli 90.9%, scaffold 71.0%); scaffold survivors and run time are 0097. Remote: https://github.com/jdforsythe/keel (branch jdforsythe/test-impl; main seeded from it).
  - running for the user: `NODE_ENV=production node apps/golden-1/server.ts` (4181) and `vite preview --port 4180` (apps/golden-1); open http://localhost:4180/ with `open`.
  - next (pick the first unchecked unblocked line in BACKLOG): red-team 0071/0073/0078-0090 (0054 per-request stores design); 0091 sessions conformance then 0092 module; 0057-0065 freeze gaps; 0044; 0069.
  - process: tests never call process.chdir (Stryker workers refuse it; spy process.cwd); scaffold Stryker tuning keys on STRYKER_MUTATOR_WORKER; rfc:0000 pre-implementation fixes; RFCs 0001-0023 in docs/rfc; delegation tiers in docs/WORKFLOW.md; never Stryker inPlace; shared git index means agents must stage by explicit path.
  blockers: none
pending decisions: none
last updated: 2026-11-06 (0096, 0035 closed; size budgets now measure real esbuild bundles, all three met)
```
