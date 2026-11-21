# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through e967c745, gated in `.worktrees/verify` (build, both apps' `keel test`, ledger and evidence written there, `pnpm check`, the full `pnpm test` of 85 tasks, `pnpm ledger --diff` with 0 lowered and 0 uncovered). It holds RFC 0151 (`keel docs`), RFC 0156 (k.mount-scope), RFC 0164 to 0167, a `Tabs` click fix, the head-to-head eval harness and the eval's public mode. Watch its CI run.
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a ledger written after `vitest run` alone loses about 120 items.
  - `keel docs <id>` works on the main line. `pnpm spec <id>` still works in this repo.
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - the operator's decisions of 2026-11-21 (D42 to D50) are each written as an RFC on a lane branch: the module contract and component signature (RFC 0157, 0162), app data and the Postgres module (0158), custom components and the library format (0159, 0163), declared third-party origins (0160), the k.shell split (0161). The freeze flip waits for their builds.
  - in flight: `## Lanes (2026-11-21)` in the active plan lists each worktree, branch and state.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate of the plan's `## Method` in `.worktrees/verify`, with the full `pnpm test`; read each command's own last `ok` or `fail` line (a pipe hides the exit status, D51).
  - safe to clear: NO while subagents run (the RFC 0160 merge agent, the RFC 0161 fix lane, the RFC 0157 author follow-up). Their branches hold their work if the context ends.
blockers: none
pending decisions: two need the operator before work proceeds. (1) D59, before the module contract build starts: pages are in the contract; full route ids as keys; one id per method (`kitchen.recipes` becomes `kitchen.box` and `kitchen.add`); `public.routes` removed; E1562 covers API entries only; runtime ops take no ctx; a component that reaches no effect may leave `ctx` out. The orchestrator recommends accepting each. (2) D57: the stdlib's eight kernel `internal` imports become public seams, so the stdlib holds no power a library lacks; it widens the kernel surface before the freeze and touches D54's closed shell set. Everything else goes ahead on the orchestrator's recommendation, to confirm or reverse: D19 to D40 (four budget re-bases among them), the nine questions of D25, and D51 to D61 of today (the `CLAUDE.md` link rule, `Frame` as a base element, the shell set closed for 1.0, no rule against records in a server store, the name `Foreign` for the host element, no Trusted Types policy for libraries, `@keel/compiler/client`, `@keel/cli` at 26 kB). Still to ask when their work starts: the golden-3 agent run (cost, a container), the first head-to-head pair (the harness's own estimate is 20 to 60 dollars, with no run behind it), and the open decisions of tasks/p1/PLAN.md. W4 (the external audit and pen test) has not been scoped.
last updated: e967c745 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
