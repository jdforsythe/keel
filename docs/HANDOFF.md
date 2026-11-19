# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 9c0102ec, gated in a clean checkout (`pnpm check`, both apps' `keel test`, `pnpm ledger --diff`, the evidence check, `pnpm build`; the full `pnpm test` was left to CI's shards). Later commits on the main line are local: the lane 05 merge and its review fixes, with `pnpm check`, the check suite and `pnpm ledger --diff` green; the ledger and evidence are written in `.worktrees/verify` before the next push. Lane branches under `.worktrees/` are local only.
  - built and conformance-covered this week: the server boundary and bundle rules, the identity seam and mount, `@keel/std-tokens`, `@keel/check/explain`, shell sign-in (`k.return`), std-report with `keel report`, std runtime entries (lint S0009). golden-2 exercises every std module that was unused.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md` (a 0.x preview first; no licence until launch); P1 work has started ahead of the freeze flip.
  - in flight: see `## Lanes` in the active plan; it lists each lane's worktree, branch and state, what is merged and what waits.
  - first thing on resume: `git worktree list` and `## Lanes` in the active plan; then the CI run on the pushed head (`gh run list --limit 2`).
  - safe to clear: NO while the RFC 0150 build lane runs in `.worktrees/w03`; see `## Lanes` in the active plan for every lane and what waits.
blockers: none
pending decisions: none blocks work. Asked of the operator and not yet answered: ADR-0173 (`keel docs` replaces `keel spec`; thirteen app skills become seven), which gates W5's skill, packing and conformance lanes; the thirteen design choices of RFC 0151; the RFCs lane 09 names (0690, 0867). To confirm or reverse: D19 to D21 in the active plan. Still to ask when their work starts: whether the golden-3 agent run needs a container, and the open decisions of tasks/p1/PLAN.md.
last updated: 39309c82 2026-11-19
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
