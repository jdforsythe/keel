# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: every commit is pushed (see `git log -1`). CI runs on the public repository; the last full run is green on f184c8e4 (check, six test shards, build, budgets, built smokes, Postgres, Tauri on Linux and macOS, Android, iOS). `test-macos` runs weekly once this branch is on master.
  - built and conformance-covered this week: the server boundary and bundle rules, the identity seam and mount, `@keel/std-tokens`, `@keel/check/explain`, shell sign-in (`k.return`), std-report with `keel report`, std runtime entries (lint S0009). golden-2 exercises every std module that was unused.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews are P1 gates); G3 waits for the freeze review.
  - in flight: nothing. Done on 2026-11-19 and pushed: backlog 0921 (the server's mutation run finishes: 78.4 against 70, no missing bound found; tasks/0338-s8-reach/proposed/server-mutation-tail.md) and backlog 0961 (a session and the outbox drain replayed by automation in the macOS Tauri shell and the iOS Simulator app; tasks/0963-to-p1/shell-session-proof.md).
  - first thing on resume: the CI run on the pushed head is the first with D6 and D7 of the active plan (a longer simulator boot bound; two vitest workers for `@keel/cli` in CI) and the first in which `shell-ios` can reach its replay steps (backlog 0965; `shell-tauri-macos` passed them on 7d06c7bf): `gh run list --limit 2`, then fix what fails there before taking backlog 0956.
  - safe to clear: YES.
blockers: none
pending decisions: the operator confirms or reverses D69 to D87 in tasks/0338-s8-reach/PLAN.md and D1 to D10 in the active plan, and the open decisions O1 to O11 of tasks/p1/PLAN.md; none blocks work. The golden-3 agent run (2 to 10 dollars estimated) waits for the operator's word.
last updated: c4ec024c 2026-11-19
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
