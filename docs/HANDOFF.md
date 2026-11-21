# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 60f98d39; CI run 44936139831 on it was in progress at this checkpoint: read its result first. Merged after it and not pushed: a TLS Postgres in CI (e3850ff8), the mutation tooling for app units (b144f6bd), plan commits. The ledger is at 1,761 items, 1,562 verified, 18 unsafe. The gate follows CI's order: check, both golden `keel test`, ledger, evidence, ci-shards, test, build, the four smokes (`restart`, `workflow`, `dev-signin`, `resume 3`), and std-postgres with std-db against a throwaway `postgres:17`; regenerate evidence as the last commit before it. After any push that carries code, watch its CI run to the end before pushing again.
  - built and on the main line since 2026-11-21: `keel docs` (RFC 0151); the router's mount scope (0156); declared third-party origins (0160); the k.shell split (0161); `servedBy` and a closed deployable object (0168); custom components with `Host` (0159); the stdlib off kernel internals, first part (0169); the module contract and `(props, ctx)` (0157, 0162); four small kernel RFCs (0164 to 0167); app data outside the kernel with `@keel/std-postgres` (0158); the privacy readers with W1114, E2506, E2203 (0170); ledger range clauses (0171); E1586 (0172); `tokens(ctx).idOf` (0173); the client's service map and E1011 (0174).
  - in lanes: `.worktrees/w14g2` `lane-w14g2`: golden-2's app data on `@keel/std-postgres` and RFC 0175 (the gaps that app met), being built; `.worktrees/r176` `lane-r176`: RFC 0176 and 0177 written, conformance being written. Written and not built: the library format (RFC 0163, `lane-r163`).
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a package's tests are run from its folder (check's fixture conformance depends on the launch directory).
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate in `.worktrees/verify` in D63's order; read each command's own last `ok` or `fail` line.
  - safe to clear: only after the lanes named above have reported; a subagent that is cut off leaves its commits on its branch, and the active plan says what each owes.
blockers: none
pending decisions: none blocks. To confirm or reverse, each decided on the orchestrator's recommendation and recorded in the active plan: D19 to D40, the nine questions of D25, and D51 to D85 of 2026-11-21. The ones of D79 change what an app author sees: a layout keeps `errorElement` and may belong to another module; a channel's entries are written out in the contract; `sessions.tally` is always served where std-sessions is placed, behind its guard; one loader serves one entry; the identity mount is tested on the decoded path; a link is same-origin wherever it is followed; `Frame` is a base element; the shell set is closed for 1.0; a deployable's object in `topology.ts` is closed. The operator's to start: the golden-3 agent run (`pnpm eval --task golden-3 --runner claude --model <id> --max-iter 3`, in a container or with a throwaway home, since the runner starts the agent with permission prompts off) and the first head-to-head pair. Not started: W4 (the external audit and pen test) scoping.
last updated: b144f6bd 2026-11-21
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
