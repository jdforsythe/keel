# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 5cb06250 (CI green). The main line is ahead of it by plans, docs and the local merges of RFC 0155 and weakness lane 04. The gate passed on 2f7f64e7 in `.worktrees/verify` with the full `pnpm test` (85 tasks); the ledger and evidence it rewrote are uncommitted there.
  - built and conformance-covered this week: the server boundary and bundle rules, the identity seam and mount, `@keel/std-tokens`, `@keel/check/explain`, shell sign-in and links into a shell (`k.return`, `k.opening`, `k.links`), std-report with `keel report`, std runtime entries (lint S0009), the blank set of `required`, a `Secret` under an undeclared key, `piiPaths` of an open object, no source map served. golden-2 exercises every std module that was unused.
  - on the main line and not yet whole: the seven published skills (`packages/cli/skills/`, copied to `.claude/skills/`) cite `keel docs <id>`, which exists only on `lane-w5l1` until RFC 0151 merges. In this repo use `pnpm spec <id>` where a skill says `keel docs <id>`.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md` (a 0.x preview first; no licence until launch); P1 work has started ahead of the freeze flip.
  - in flight: see `## Lanes` in the active plan; it lists each lane's worktree, branch and state, what is merged and what waits. Two lanes hold work: `lane-w5l1` (RFC 0151, close to its merge) and `lane-w03b` (weakness lane 03, reviewed, needs a fix lane).
  - first thing on resume: `git worktree list` and `## Next action` in the active plan; then the CI run on the pushed head (`gh run list --branch jdforsythe/test-impl --limit 2`).
  - before a push: the gate of the plan's `## Method` in `.worktrees/verify`, with the full `pnpm test`. A push without it broke 16 tests on 2026-11-19 (D33, D35).
  - safe to clear: YES. No subagent and no gate is running.
blockers: none
pending decisions: none blocks work. Nine questions asked of the operator and not yet answered go ahead on the orchestrator's recommendation (D25 in the active plan lists them): ADR-0173 (`keel docs` replaces `keel spec`; seven published skills), RFC 0151's design choices, RFC 0152 to 0154, the RFCs for 0690 and 0867, E1107's reach (0880), the blank-text rule left in three places (0804), the `bearer` guidance in the skill, RFC 0142 with ADR-0164. The operator decided D42 to D45 on 2026-11-21 (the module contract and app data outside the kernel are required work, W13 and W14 of `tasks/p1/PLAN.md`; no charts in the framework, custom components instead, W15; a small head-to-head eval first, W16); D46 (declared third-party origins) and D47 (the k.shell split) are recommended and await the answer. The freeze flip waits for W13. To confirm or reverse: D19 to D40, among them four budget re-bases (`@keel/std-offline` 3.7 kB, `@keel/testing` 13.6 kB, `@keel/router` 11.3 kB, the spec map 1,250 tokens; `docs.map` 1,300 comes with RFC 0151). Still to ask when their work starts: whether the golden-3 agent run needs a container, and the open decisions of tasks/p1/PLAN.md.
last updated: d0c7c49f 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
