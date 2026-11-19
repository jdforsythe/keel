# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed head b26f6575. CI runs on the public repository; the last full run is green on f184c8e4 (check, six test shards, build, budgets, built smokes, Postgres, Tauri on Linux and macOS, Android, iOS). `test-macos` runs weekly once this branch is on master.
  - built and conformance-covered this week: the server boundary and bundle rules, the identity seam and mount, `@keel/std-tokens`, `@keel/check/explain`, shell sign-in (`k.return`), std-report with `keel report`, std runtime entries (lint S0009). golden-2 exercises every std module that was unused.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews are P1 gates); G3 waits for the freeze review.
  - in flight when this was written (2026-11-19): one subagent, committing to this branch without pushing: backlog 0921, the server's stalling mutants; findings in tasks/0338-s8-reach/proposed/server-mutation-tail.md. If that file is missing, the agent did not finish.
  - done, committed, not pushed: backlog 0961, a session and the outbox drain replayed by automation in the macOS Tauri shell (accessibility API) and the iOS Simulator app (a UI test); findings in tasks/0963-to-p1/shell-session-proof.md. The new CI steps have not run on a hosted runner: the first run after the push is the proof (backlog 0965).
    On resume: `git log origin/jdforsythe/test-impl..HEAD --oneline`; review, gate in a clean checkout, push, then watch the `shell-tauri-macos` and `shell-ios` jobs.
  - safe to clear: NO while the agent above runs. This line is changed to YES when it has reported and every commit is pushed.
blockers: none
pending decisions: the operator confirms or reverses D69 to D87 in tasks/0338-s8-reach/PLAN.md and D1 to D5 in the active plan; none blocks work.
last updated: b26f6575 2026-11-19
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
