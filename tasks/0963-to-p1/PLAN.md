# Task 0963: to the start of P1

Close what stands between the built stages and P1 planning. The work runs in subagents; the orchestrator briefs, reviews, merges, gates and writes the handoff.

## Read on resume
Read only this file and `docs/HANDOFF.md`. Everything else is fetched when a step needs it, and by the subagent doing the step where possible:
- A decision by number (D1 to D87): `grep -n "^- D<n> " tasks/0338-s8-reach/PLAN.md`. Do not read that file whole; it is the record of the S8 task.
- A backlog line: `grep -n "^- \[.\] <id> " tasks/BACKLOG.md`.
- A spec section: `pnpm spec <topic>`. An RFC: the one file in `docs/rfc/`.
- A subagent's brief names the files it must read; the orchestrator does not read them first.

## Decisions
- D1 (2026-11-19): this task replaces 0338 as the active task so a resume reads a short plan. 0338's decisions stay in its plan and are cited by number.
- D2 (2026-11-19, operator): S6 is provisionally closed; the external a11y audit and pen test are P1 gates and S6 reopens if either fails.
- D3 (2026-11-19, operator): the return-link restriction (backlog 0956) is agreed.
- D4 (2026-11-19, operator): a session in a macOS or iOS shell is proven by automation first, since that repeats; a person at the machine is the fallback for a one-time check (backlog 0961).
- D5 (2026-11-19, operator): no `/clear` while a subagent runs; the handoff says when it is safe.
- D6 (2026-11-19): `tooling/smoke/shell-launch.mjs` gives a simulator 900 s to boot (was 300 s) and the `shell-ios` job 45 minutes (was 30). The hosted runner's first boot migrates data for about five minutes: three runs in a row failed E0014 at `Migration Elapsed:04:55`, and the one green run booted just under the bound.
- D7 (2026-11-19): in CI `@keel/cli` runs its test files on two vitest workers (`WORKERS` in `tooling/ci-shards.mjs`). `conformance/E1562-base-route-change.test.ts` spawns about twenty builds inside a 120 s test limit and took 117 s to 172 s for the file across four runs on the 4-core runner, failing T0001 in two; the limit is in a conformance file, so the load is lowered instead. If the file still nears its limit with two workers, the limit needs an `rfc:` change.

- D8 (2026-11-19): RFC 0147 and ADR-0169 (backlog 0956) are accepted as written by the design lane. An opening is one external-browser open by a mount request; it lasts 600000 ms, is kept in `ctx.storage` `keel.return` so a relaunch during sign-in keeps it, admits one link, and a new one replaces it. No binding value: the library's `state` and PKCE bind the flow. Two consequences for the operator to confirm: a link to a page needs an opening too (the agreed wording covers every return link, so the scheme is no general deep link into the app), and a flow started outside the app (an emailed link) cannot return to it. Residual risk in the threat model: another app can send its link first while an opening is pending.

- D9 (2026-11-19): the first wave of `tasks/p1/PLAN.md` starts before the freeze review closes, on the operator's word to run more lanes at once: weakness triage under the O1 definition, release hygiene and the evidence gates. None touches a kernel section.

## Method
- RFC unit: RFC, spec and ADR; then conformance by the `conformance-writer` from the spec; then the build. Conformance and build run in their own git worktree and branch, merged when green, so red tests never sit on the main line.
- Before a push: `pnpm check`, `pnpm test`, both apps' `keel test`, `pnpm ledger --diff`, `node tooling/evidence-report.mjs --check` and `pnpm build` on the exact commit in a clean checkout, each gated on its own exit status. `pnpm ledger` and `pnpm evidence:report` are written from a clean tree after both apps' `keel test`.
- One mutation run at a time (machine-wide lock). Few test-running agents at once: the machine is shared, and spawn-heavy cli conformance times out under load (backlog 0938).

## Lanes in flight (2026-11-19)
Each lane is a subagent; a lane in a worktree commits on its branch and the orchestrator reviews and cherry-picks. A lane with no report is re-briefed from this list.
- `.worktrees/0956`, branch `rfc-0147`: conformance for RFC 0147 (conformance-writer); the build follows on the same branch.
- `.worktrees/0967`, branch `lane-0967`: tests for the server's surviving mutants (backlog 0967) and the std-sessions mutation config (0966). It starts no mutation run.
- golden-3 eval: ready short of the model call (backlog 0937 done; `pnpm eval --task golden-3 --runner none` ends `converged=false` only because `apps/golden-3` is absent). The agent run is `pnpm eval --task golden-3 --model claude-sonnet-5-5`, at most 5 iterations; earlier golden runs cost 0.84 to 2.55 dollars each, so this one is estimated at 2 to 10. It waits for the operator's word on spending and for a quiet machine (it runs the root check and test each iteration).
- main tree, `tasks/0963-to-p1/freeze-review.md`: the freeze review audit (backlog 0034), report only.
- `tasks/p1/PLAN.md` is written (backlog 0962): twelve P1 workstreams, three P2, a first wave, proposed backlog lines and open decisions O1 to O11 for the operator, each with a recommendation. Its proposed lines are not yet in `tasks/BACKLOG.md`.
- `.worktrees/hygiene`, branch `lane-hygiene`: backlog 0946 (no home paths or quoted operator messages in tracked files, with a check), 0943 (packages private until launch), 0944 (`.gitignore`, `SECURITY.md`, `CONTRIBUTING.md`).
- `.worktrees/evidence`, branch `lane-evidence`: backlog 0877 (the evidence report refuses a dirty tree) and 0892 (a gate for a committed ledger or evidence file that differs from the tree).
- main tree, `tasks/p1/weaknesses.md`: the triage of every open backlog line and the fix lanes (W2 steps 1 and 2 of `tasks/p1/PLAN.md`), under the weakness definition its O1 recommends.

## Verification
- [ ] Backlog 0956 built and conformance-covered. RFC 0147, ADR-0169, k.return and the threat model are written (k.return is `implemented` until its conformance lands); next the conformance lane, then the build, each in a worktree.
- [x] Backlog 0921: the server's mutation run finishes (78.4 against 70); findings in `tasks/0338-s8-reach/proposed/server-mutation-tail.md`; follow-ups are backlog 0966 and 0967.
- [ ] Backlog 0961: a session proven in the macOS Tauri shell and the iOS shell (done locally by automation; the hosted-runner run is backlog 0965).
- [ ] golden-3 built by an agent run of its eval; the eval converges.
- [ ] Freeze review (backlog 0034): every kernel section conformance-covered, the `frozen` flip prepared for P1.
- [x] P1 and P2 plan written from `tasks/p1/INPUT.md` (backlog 0962): `tasks/p1/PLAN.md`; the operator reads its open decisions O1 to O11.

## Next action
Read the CI run on the pushed head (`gh run list --limit 2`): it is the first with D6 and D7, and the first in which `shell-ios` can reach its replay steps (backlog 0965; `shell-tauri-macos` passed them). Check `shell-ios` and the seconds of `conformance/E1562-base-route-change.test.ts` in `test-shard (5)`. Fix what fails there, then take backlog 0956.

1. Backlog 0956: RFC amendment to `k.return` (a return link is accepted only while the shell has opened the external browser from a mount redirect, once), conformance, build, threat model.
2. golden-3 by agent eval (`evals/tasks/golden-3`; the first step with model calls; the runner's default is `none`, an agent run names a model). Its `browser.ts` needs a sign-in secret (backlog 0937).
3. Freeze review (backlog 0034) and G3.
4. The P1 and P2 plan (backlog 0962), in a context of its own.
5. Alongside, when the machine is quiet: backlog 0966 (std-sessions mutation config) and 0967 (server survivors).
