# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 28a9c4de (CI green on 67c75523 before it). In that push: the scaffold first-run fixes, the walkthrough app `apps/household` through layer 6, six framework faults fixed with their conformance cases, the scenario tests, `keel review` (RFC 0178). 28a9c4de is gated and pushed; read its CI run first (`gh run list --branch jdforsythe/test-impl --limit 1`). The gate's root `pnpm test` failed twice under load on `tooling/test/watchdog.test.ts` (backlog 1028) and passed with every task at low load. The ledger is at 2,263 items, 1,748 verified, 18 unsafe. The gate follows CI's order: check, `keel test` in the golden apps, household and each example, the ledger and a11y checks, evidence, ci-shards, test, build, the smokes (`restart`, `workflow`, `dev-signin`, `resume 3`, `examples`, `household`, `canary`), and the postgres job against a throwaway `postgres:17`; regenerate evidence as the last commit before it. Keep to four test-running lanes at once. After any push that carries code, watch its CI run to the end before pushing again.
  - built and on the main line since 2026-11-21: `keel docs` (RFC 0151); the router's mount scope (0156); declared third-party origins (0160); the k.shell split (0161); `servedBy` and a closed deployable object (0168); custom components with `Host` (0159); the stdlib off kernel internals, first part (0169); the module contract and `(props, ctx)` (0157, 0162); four small kernel RFCs (0164 to 0167); app data outside the kernel with `@keel/std-postgres` (0158); the privacy readers with W1114, E2506, E2203 (0170); ledger range clauses (0171); E1586 (0172); `tokens(ctx).idOf` (0173); the client's service map and E1011 (0174).
  - in lanes, finished work waiting, no subagent running but the gate (the active plan's Lanes block says what each owes): `lane-r176` (RFC 0176 and 0177 built; blocked on a lint rule, the operator's call), `lane-r180` (RFC 0179 to 0183 written with conformance), `lane-r184` (RFC 0184 written). Written and not built: the library format (RFC 0163, `lane-r163`).
  - how features are proven: `tasks/p1/feature-coverage.md` (the walkthrough app, scenario tests, one-feature apps under `examples/`).
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a package's tests are run from its folder (check's fixture conformance depends on the launch directory).
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate in `.worktrees/verify` in CI's order; read each command's own last `ok` or `fail` line.
  - safe to clear: YES. No subagent runs; only the CI run on 28a9c4de is open.
blockers: none
pending decisions: none blocks. To confirm or reverse, each decided on the orchestrator's recommendation and recorded in the active plan: D19 to D40, the nine questions of D25, and D51 to D88 of 2026-11-21. The ones of D79 change what an app author sees: a layout keeps `errorElement` and may belong to another module; a channel's entries are written out in the contract; `sessions.tally` is always served where std-sessions is placed, behind its guard; one loader serves one entry; the identity mount is tested on the decoded path; a link is same-origin wherever it is followed; `Frame` is a base element; the shell set is closed for 1.0; a deployable's object in `topology.ts` is closed. The operator's to start: the golden-3 agent run (`pnpm eval --task golden-3 --runner claude --model <id> --max-iter 3`, in a container or with a throwaway home, since the runner starts the agent with permission prompts off) and the first head-to-head pair. Not started: W4 (the external audit and pen test) scoping.
last updated: 28a9c4de 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
