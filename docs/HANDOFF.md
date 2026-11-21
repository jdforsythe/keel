# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through ecb43f37 (RFC 0168, the topology key `servedBy`, with it), gated in `.worktrees/verify` (D63's order; the full `pnpm test` of 85 tasks green on a continue run, two cli conformance files failing only under load). It holds RFC 0151, 0156, 0160 (declared third-party origins, red-teamed), 0161 (the k.shell split), 0164 to 0167, RFC 0169's first part (the stdlib on public API), a `Tabs` click fix and the eval harness with its public mode. Watch its CI run.
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a ledger written after `vitest run` alone loses about 120 items.
  - `keel docs <id>` works on the main line. `pnpm spec <id>` still works in this repo.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - the operator's decisions of 2026-11-21 are each an RFC on a lane branch, with conformance written: the module contract and component signature (RFC 0157, 0162; build plan `tasks/p1/w13-build.md`, stage 2 of five running; stage 1 is merged into the integration branch `lane-r157`), app data and the Postgres module (0158), custom components with the `Host` element (0159, built on `lane-r159`, merging) and the library format (0163, written; its spec text waits on `lane-r163`), the topology key `servedBy` (0168, pushed), the stdlib on public API (0169, its second part after 0163). The freeze flip waits for their builds.
  - in flight: `## Lanes (2026-11-21)` in the active plan lists each worktree, branch and state.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate in `.worktrees/verify` in D63's order; read each command's own last `ok` or `fail` line.
  - safe to clear: NO while subagents run (W13 stage 2 in `.worktrees/w13-l3`, `w13-l4`, `w13-l5` and a conformance fix in `.worktrees/r157`; the merge of RFC 0159 in `.worktrees/m159`). Their branches hold their work if the context ends.
blockers: none
pending decisions: none blocks. Decided by the operator on 2026-11-21 (D65, D67): no migration tooling or notes before P1; sizes re-based, not squeezed, with one review before P1 (backlog 0993); the element is `Host`; the topology key is `servedBy`; pages stay in the contract; the stdlib moves onto public API. Going ahead on the orchestrator's recommendation, to confirm or reverse: D19 to D40, the nine questions of D25, and D51 to D69 of 2026-11-21 (among them: `Frame` as a base element, the shell set closed for 1.0, a closed deployable object in `topology.ts`, `sampleFormat` and `secretPath` public in `@keel/schema`, the spec map's budget following its row count). The operator's to start: the golden-3 agent run (`pnpm eval --task golden-3 --runner claude --model <id> --max-iter 3`, in a container or with a throwaway home, since the runner starts the agent with permission prompts off) and the first head-to-head pair. Not started: W4 (the external audit and pen test) scoping.
last updated: ecb43f37 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
