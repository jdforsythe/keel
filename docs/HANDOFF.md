# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: every commit on the main line is pushed (see `git log -1`); lane branches under `.worktrees/` are local only. On the pushed head `pnpm check`, `pnpm test`, `pnpm build`, `pnpm ledger --diff` and the evidence check pass locally. CI: the run on ea4c6c37 passed every shard and `shell-ios`; its `check` failed on ledger items that the pushed head restores.
  - built and conformance-covered this week: the server boundary and bundle rules, the identity seam and mount, `@keel/std-tokens`, `@keel/check/explain`, shell sign-in (`k.return`), std-report with `keel report`, std runtime entries (lint S0009). golden-2 exercises every std module that was unused.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md` (a 0.x preview first; no licence until launch); P1 work has started ahead of the freeze flip.
  - in flight: see `## Lanes` in the active plan; it lists each lane's worktree, branch and state, what is merged and what waits.
  - first thing on resume: `git worktree list` and `## Lanes` in the active plan; then the CI run on the pushed head (`gh run list --limit 2`).
  - safe to clear: YES. No subagent is running; three lane branches wait in `.worktrees/` (w01, w03, w08), described in the active plan.
blockers: none
pending decisions: none blocks work. The operator settled the return-link design (D18), the 0.x preview, no licence until launch, and golden-3 after the agent docs (D13 to D16 in the active plan). Still to ask, in conversation with a recommendation: whether `keel docs` replaces `keel spec` in the public CLI and thirteen app skills become seven (ADR-0173), whether the golden-3 agent run needs a container, and the remaining open decisions of tasks/p1/PLAN.md when their workstream starts.
last updated: 55696440 2026-11-19
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
