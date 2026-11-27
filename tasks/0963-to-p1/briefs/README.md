# Lane briefs for task 0963

What a subagent in a lane is told, so a fresh orchestrator can brief one without the session that wrote the first brief. `lanes.md` holds each open lane's state and what it owes.

## Rules every lane brief carries

- Done right comes before done (the plan's D191). A lane never weakens Keel to get through: no new `unsafe/` file where a typed way exists, no rule exemption, no loosened or deleted assertion, no raised limit or budget for a limit that is not a size budget, no skipped or retried test, no narrower public surface than the design asks for. When the right way is blocked, the lane stops on that point and reports it with the reason; the orchestrator decides.

- Work only in the lane's worktree. Do not push. Do not merge into the main line unless the brief is an integrator's.
- Never edit `packages/*/conformance/**`, except removing a skip marker in a commit prefixed `rfc:NNNN`. A case that disagrees with the spec is reported with file:line and the spec sentence; the `conformance-writer` subagent corrects it. A builder cannot spawn one: the orchestrator does.
- The order for an RFC: spec text applied to `spec/` (so `pnpm spec <id>` prints the clauses), then conformance by the `conformance-writer` from the spec text only, then the build.
- No `any`, casts, non-null assertions or `@ts-ignore` outside `unsafe/`. Docs, spec text and comments say what exists now. Person-facing text follows `docs/BRAND.md`.
- One test command at a time, each bounded by a timeout; while `uptime` load is above 30, wait with a bounded polling loop. Stop every server, browser and container the lane starts; a docker container carries the lane's name. Never ports 8080, 5173, 5214. Port 5432 is taken on this machine. A container never bind-mounts a path under the main checkout or the home folders macOS guards (a mount there has hung Docker at `Created`): copy a clone in with `docker cp`, from a folder under `$TMPDIR`; bound every docker command with a timeout.
- A package's suite is run from its own folder (`pnpm test`). An app's a11y evidence comes from `node ../../packages/cli/src/bin.ts test` in the app.
- Do not run `pnpm ledger` in a lane (the plan's Method, D100). `ledger-fresh` in `pnpm check --quiet` then reports the lane's new rows: the lane lists them, and the orchestrator regenerates the ledger on the main line after `keel test` in golden-1, golden-2, household and each `examples/*`.
- A size budget (bytes of a package or an entry) that overruns is re-based and noted in the commit message. A token limit (`spec.section`, `docs.section`, `spec.map`, `docs.map`, a skill's target) is never raised: the text is trimmed without changing meaning, or moved to a section with room. An edit the permission system refuses is reported, not retried in another form.
- Identity is opt-in (the plan's D103). A feature that needs a server, sign-in or identity states what turns it on; an app that has not opted in makes no request, carries no config and ideally no bytes for it, with a test that proves it; a half-opted-in app is a check error; an app that opts in gets every protection, and the proofs that enforce them (pii canaries, compliance rules, evidence) cover the new surface.
- Commits end with the session's attribution trailers.
- The report states: commits, what is green with each command's last `ok` or `fail` line, what was not run, conformance disputed or owed, budgets re-based, `ledger-fresh` rows.

## Personas

`tasks/p1/personas.md` lists who Keel is built for. A writer names the personas an RFC touches and answers their questions; a reviewer who tries to break a change works as the persona it exposes most.

## The orchestrator

- Before a commit on the main line, read `git status --short` and stage files by name: a lane's subagent has once edited a file in the main worktree, and `git add -A` carried it into a handoff commit.
- A subagent's report that it is done is checked against its brief's verification list; an unfinished lane is sent back, not merged.

## Merging a lane

1. In the lane: merge the main line; generated files in conflict (`tooling/ledger/ledger.json`, evidence, `tasks/COVERAGE.md`, `.keel/surface.json`) take either side; `tooling/budgets.json` keeps the larger value; hand-written files keep both sides' intent.
2. Root `pnpm check --quiet` clean but for `ledger-fresh`; every package's suite (the whole `pnpm test`, or each package folder in turn: a chosen list once missed the one suite a merge broke); every app's and example's `keel test`; `pnpm build`; the smokes the lane touches.
3. On the main line: `git merge --no-ff`, with the lane's `rfc:NNNN` tags in the message when it carries conformance changes. Then regenerate the ledger as Method's D100 says and commit it.
4. The gate, in `.worktrees/verify`, before a push (Method, D97; `docs/HANDOFF.md` lists its steps).

## Waiting and teardown

Wait on something you own: a file your command writes at its end, or its exit code. Never wait with `pgrep -f <text>` when the waiting command's own line holds that text: it matches itself and never ends. Give every wait loop an upper bound. Before you report, stop every loop, server and container you started and remove the temp folders you made; say in the report what, if anything, is left.

## Docs freshness

A doc's `verified:` line says someone checked the whole doc against the tree at that commit. Move it only when you have done that and corrected what was wrong. If `docs-freshness` fails (D0001) on a doc your lane did not change, report it and leave the line alone: moving the line to get a gate through is a weakened check.
