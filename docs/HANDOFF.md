# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: pushed through 317c2218 after a full green gate; CI is green on every job (run 45049631780). Nothing but docs commits is ahead of it. The gate follows CI's order: check, `keel test` in the golden apps, household and each example (then once more in golden-1, golden-2 and household under CPU burners, to stand in for a slow runner), the ledger and a11y checks, evidence, ci-shards, test, build, every built smoke, and the postgres job against throwaway `postgres:17` containers; regenerate evidence as the last commit before it. Root `pnpm test` counts only when a whole run ends `ok` with every task run (the plan's Method, D97); the ledger is regenerated only as Method's D100 says. Keep to four test-running lanes. After a push that carries code, watch its CI run to the end before pushing again.
  - built on 2026-11-22, all on the main line: RFC 0176, 0177 (`Text role`, E1508), 0179 to 0184 (static build; `renderRoute` with `app`; E1304; sim window edges; one document source with `styles`; serializable transactions), 0185 (a signed-in `renderRoute` page, a cookie jar per harness, Node's fetch classes under `keel test`), 0187 (a layout of another module), 0189 (links in every shell), 0190, 0191 (inspect sections per deployable; E1820 at render), 0192 (a channel follows app data), 0194 (harness, dev and net clauses), 0195 (E1550); a `keel dev` document links its styles; `keel dev` survives an edit to a file declaring a database; `apps/household` to `docs/BRAND.md` with one `app.frame`, live updates and the weekly staples workflow; `examples/` links-in, compose-peers, codemod-place, shell-mount; the smokes `workflow-postgres.mjs` and `csp.mjs`; `pnpm test` no longer stops at the first failed task.
  - worktrees besides this one: `.worktrees/verify` (the gate's clean checkout) and `.worktrees/mutate` (`lane-mutate`, mutation runs; see the plan's checkpoint 9). Written and not built: RFC 0186, 0188, 0193 (the operator's to decide), the library format (RFC 0163, branch `lane-r163`).
  - how features are proven: `tasks/p1/feature-coverage.md` (the walkthrough app, scenario tests, one-feature apps under `examples/`).
  - a golden app's a11y evidence is written by `keel test` (`node ../../packages/cli/src/bin.ts test` in the app), not by the app's `test` script; a package's tests are run from its folder (check's fixture conformance depends on the launch directory).
  - stages: S1 to S5, S7 and S8 closed; S6 provisionally closed (its external reviews and the golden-3 build are P1 work). The P1 plan is `tasks/p1/PLAN.md`.
  - first thing on resume: `git worktree list`, then `## Next action` in the active plan.
  - before a push: the gate in `.worktrees/verify` in CI's order; read each command's own last `ok` or `fail` line.
  - a dev server for the operator may be running on port 5214 from `apps/household` (`lsof -tiTCP:5214 -sTCP:LISTEN`): leave it unless the operator is done.
  - safe to clear: YES, once the mutation lane and the CI watch have reported; nothing else runs.
blockers: none
pending decisions: three wait for the operator, none blocks other work, the orchestrator recommends each: RFC 0186 (a kernel entry `GET /__keel/user` so a guard on a client or shell page knows the reader), RFC 0188 (brand defaults in `@keel/ui`: `base` and `look` token groups, a focus style, a lone `gap` as a check error; it reverses ADR-0067), RFC 0193 (an open stream judges the user again and closes `denied`; changes k.user and k.server). To confirm or reverse, each decided on the orchestrator's recommendation and recorded in the active plan: D19 to D40, the nine questions of D25, D51 to D88 of 2026-11-21, D89 to D101 of 2026-11-22 (D89 the lint rule off; D90, D91 RFC 0180; D92 dev styles; D93 RFC 0187; D94 RFC 0189; D95 RFC 0190 and 0191; D97 the gate rule; D98 RFC 0192; D99 RFC 0195; D100 the ledger rule; D101 a property test's time scales with its runs). Also the operator's: whether `tooling/docs-freshness.mjs` scopes each doc to its subject's paths (the plan's checkpoint 9. The operator's to start: the golden-3 agent run (`pnpm eval --task golden-3 --runner claude --model <id> --max-iter 3`, in a container or with a throwaway home) and the first head-to-head pair. Not started: W4 (the external audit and pen test) scoping.
last updated: 317c2218 2026-11-22
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.
