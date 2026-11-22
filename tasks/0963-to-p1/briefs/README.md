# Lane briefs for task 0963

What a subagent in a lane is told, so a fresh orchestrator can brief one without the session that wrote the first brief. `lanes.md` holds each open lane's state and what it owes.

## Rules every lane brief carries

- Work only in the lane's worktree. Do not push. Do not merge into the main line unless the brief is an integrator's.
- Never edit `packages/*/conformance/**`, except removing a skip marker in a commit prefixed `rfc:NNNN`. A case that disagrees with the spec is reported with file:line and the spec sentence; the `conformance-writer` subagent corrects it. A builder cannot spawn one: the orchestrator does.
- The order for an RFC: spec text applied to `spec/` (so `pnpm spec <topic>` prints the clauses), then conformance by the `conformance-writer` from the spec text only, then the build.
- No `any`, casts, non-null assertions or `@ts-ignore` outside `unsafe/`. Docs, spec text and comments say what exists now. Person-facing text follows `docs/BRAND.md`.
- One test command at a time, each bounded by a timeout; while `uptime` load is above 30, wait with a bounded polling loop. Stop every server, browser and container the lane starts; a docker container carries the lane's name. Never ports 8080, 5173, 5214. Port 5432 is taken on this machine.
- A package's suite is run from its own folder (`pnpm test`). An app's a11y evidence comes from `node ../../packages/cli/src/bin.ts test` in the app.
- Do not run `pnpm ledger` in a lane (the plan's Method, D100). `ledger-fresh` in `pnpm check --quiet` then reports the lane's new rows: the lane lists them, and the orchestrator regenerates the ledger on the main line after `keel test` in golden-1, golden-2, household and each `examples/*`.
- A size or token budget that overruns is re-based and noted in the commit message.
- Identity is opt-in (the plan's D103). A feature that needs a server, sign-in or identity states what turns it on; an app that has not opted in makes no request, carries no config and ideally no bytes for it, with a test that proves it; a half-opted-in app is a check error; an app that opts in gets every protection, and the proofs that enforce them (pii canaries, compliance rules, evidence) cover the new surface.
- Commits end with the session's attribution trailers.
- The report states: commits, what is green with each command's last `ok` or `fail` line, what was not run, conformance disputed or owed, budgets re-based, `ledger-fresh` rows.

## Merging a lane

1. In the lane: merge the main line; generated files in conflict (`tooling/ledger/ledger.json`, evidence, `tasks/COVERAGE.md`, `.keel/surface.json`) take either side; `tooling/budgets.json` keeps the larger value; hand-written files keep both sides' intent.
2. Root `pnpm check --quiet` clean but for `ledger-fresh`; the lane's package suites; every app's and example's `keel test`; `pnpm build`; the smokes the lane touches.
3. On the main line: `git merge --no-ff`, with the lane's `rfc:NNNN` tags in the message when it carries conformance changes. Then regenerate the ledger as Method's D100 says and commit it.
4. The gate, in `.worktrees/verify`, before a push (Method, D97; `docs/HANDOFF.md` lists its steps).
