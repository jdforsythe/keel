# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 0cb7e06b (9e94c1bb plus one conformance fix for CI), gated in `.worktrees/verify` (D63's order; the full `pnpm test` of 85 tasks green; the ledger at 1,729 items, 1,524 verified, 18 unsafe, 0 lowered, 0 uncovered). CI was red from RFC 0161's push until this head for one std-capacitor test that was wrong on Linux only (D80): confirm the run on 0cb7e06b is green (`gh run list --branch jdforsythe/test-impl --limit 2`), and after any push that carries code watch its run to the end before pushing again.
  - built and on the main line since 2026-11-21: `keel docs` (RFC 0151); the router's mount scope (0156); declared third-party origins (0160); the k.shell split with shell targets (0161); the topology key `servedBy` and a closed deployable object (0168); custom components with the `Host` element (0159); the stdlib off kernel internals, first part (0169); the module contract and the component signature `(props, ctx)` across the kernel, the stdlib, the four apps, the skills and the guides (0157, 0162); four small kernel RFCs (0164 to 0167).
  - written and not built: app data outside the kernel with a Postgres module (RFC 0158, `lane-r158`); the library format (RFC 0163, `lane-r163`).
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a package's tests are run from its folder (check's fixture conformance depends on the launch directory).
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate in `.worktrees/verify` in D63's order; read each command's own last `ok` or `fail` line.
  - safe to clear: NO while a subagent runs: CI's `built-smokes` job fails on 0cb7e06b (`node tooling/smoke/resume.mjs 1` after `pnpm build` reproduces it: golden-2's seed and a recipe page), and an opus agent diagnoses it in `.worktrees/smokes` on branch `fix-smokes`. The smokes under `tooling/smoke/` are not part of the local gate: run them after a build before a push that carries code.
blockers: none
pending decisions: none blocks. To confirm or reverse, each decided on the orchestrator's recommendation and recorded in the active plan: D19 to D40, the nine questions of D25, and D51 to D79 of 2026-11-21. The ones of D79 change what an app author sees: a layout keeps `errorElement` and may belong to another module; a channel's entries are written out in the contract; `sessions.tally` is always served where std-sessions is placed, behind its guard; one loader serves one entry; the identity mount is tested on the decoded path; a link is same-origin wherever it is followed; `Frame` is a base element; the shell set is closed for 1.0; a deployable's object in `topology.ts` is closed. The operator's to start: the golden-3 agent run (`pnpm eval --task golden-3 --runner claude --model <id> --max-iter 3`, in a container or with a throwaway home, since the runner starts the agent with permission prompts off) and the first head-to-head pair. Not started: W4 (the external audit and pen test) scoping.
last updated: 0cb7e06b 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
