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

- D10 (2026-11-19): the red-team pass on RFC 0147 reproduced two holes, so the branch is not merged as built. One opening admitted any number of links, because an admitted link's own GET recorded a new opening (a 404, an outside redirect); and a redirect to the shell's own scheme restarted the redirect count, so a loop never ended. Decided: only a request the page starts, and its redirects, record an opening; a chain started by a return link records none; an own-scheme redirect continues the row of five. The spec also states the far-future and malformed stored value and the failed write. Order: spec text, conformance, build, then a second red-team pass.

- D11 (2026-11-19): the amended return-link text does not fit `k.return`'s size limit, so the chain and stored-value rules are a section of their own, `k.opening`, as RFC 0130 and 0138 did for full sections; eleven map-only titles are shortened to pay for its row.

- D12 (2026-11-19): RFC 0147 merges with backlog 0968 open. The branch closes the hole the operator agreed to close and both holes of the first red-team pass; 0968 needs app code that navigates to the mount with no person acting, and gets an RFC of its own. Spec text for an RFC stays on its lane branch until its conformance exists: the RFC 0147 text on the main line lowered three ledger items and failed CI's `check`.

- D13 (2026-11-19, operator): the golden-3 agent run waits until the agent docs and skills of the P1 plan (workstream W5) exist, so the run tests what a public user's agent will read. W5 moves ahead of golden-3; the S6 exit proof and the audit target wait with it.
- D14 (2026-11-19, operator): the return-link restriction as built (RFC 0147, and RFC 0150 on `lane-w03`) is too strict; the operator reviews alternatives before more is built. The RFC 0150 build is stopped with uncommitted work in `.worktrees/w03`. RFC 0147 stays on the main line, unpushed, until the design is settled. This reverses D3 and D8.
- D15 (2026-11-19, operator): no licence until the public release: `LICENSE` states all rights reserved and the root package is `UNLICENSED` (backlog 0941 closed; the choice of licence is made at launch).
- D16 (2026-11-19, operator): the first public release is a 0.x preview. The kernel freeze is tried out during it, with the right to reopen before 1.0 and the intent not to need it. `tasks/p1/PLAN.md` is updated to this.
- D17 (2026-11-19): lane 02 (server scrub) merges after its red-team pass (verdict merge): backlog 0671 and 0683 fixed, 0722, 0737 and 0441 proven or stated as limits. Open from it: 0442 and 0756 (the server is 5 bytes under its size budget; 0756 also contradicts a conformance test), 0729 (the 1.2 s cost did not reproduce: about 155 ms), and new lines 0970 to 0974.

## Method
- RFC unit: RFC, spec and ADR; then conformance by the `conformance-writer` from the spec; then the build. Conformance and build run in their own git worktree and branch, merged when green, so red tests never sit on the main line.
- Before a push: `pnpm check`, `pnpm test`, both apps' `keel test`, `pnpm ledger --diff`, `node tooling/evidence-report.mjs --check` and `pnpm build` on the exact commit in a clean checkout, each gated on its own exit status. `pnpm ledger` and `pnpm evidence:report` are written from a clean tree after both apps' `keel test`.
- One mutation run at a time (machine-wide lock). Few test-running agents at once: the machine is shared, and spawn-heavy cli conformance times out under load (backlog 0938).

## Lanes (2026-11-19)
Each lane is a subagent in a worktree under `.worktrees/`, committing on its branch; the orchestrator reviews and cherry-picks. A lane with no report is re-briefed from this list.
- RFC 0147 is merged on the main line (conformance, build, the `k.opening` amendment, the fix); the reviewer and two red-team passes ran. The second pass passed the fix and found backlog 0968 (medium: an admitted link re-arms the gate through app code that navigates to the mount with no person acting) and 0969 (low, spec wording). Still to do before a push: the ledger and evidence written from a clean tree. In flight in the main tree: a conformance-writer moving the `k.opening` clause citations of `return-chains.test.ts` into header form, since the ledger reads only header citations (E1707 on 10 clauses until then); `tooling/ledger/ledger.json` is regenerated and uncommitted, and is written again after that fix.
- Stopped, `.worktrees/w03`, branch `lane-w03`: RFC 0150 (an opening needs a person's act): spec 7dcd96e7, conformance 1a248de9, and an unfinished, uncommitted build. It waits for the operator's review of the return-link design (D14).
- Held, `.worktrees/w08`, branch `lane-w08` (lane 08, three commits: pnpm overrides and `packageManager` pnpm 11.17.0, CI permissions and actions pinned by SHA, the inspector app runs the checker): not merged, because `pnpm install --frozen-lockfile` under pnpm 11 could not be verified (its release-age rule rejects a dependency published on 2026-11-18 until about 21:10 UTC on 2026-11-19) and the lockfile entry for the inspector was written by hand. Verify the frozen install in that worktree, then merge.
- In flight, `.worktrees/w01`, branch `lane-w01` (lane 01 offline-channels): nine of ten lines done, RFC 0148 and 0149 with conformance; its red-team pass reproduced two holes (a retry armed after the drain scope ends; same-seed ctxs sharing write keys), which the lane is fixing. std-offline is 76 bytes over its size budget; re-base at merge with the reason. Then a second look and the merge. Lane 02 is merged (D17).
- Merged: the server's mutation tests and the std-sessions mutation config (backlog 0967 tests, 0966); the mutation runs of server and std-sessions are still to do, on a quiet machine. Release hygiene (0946 with check H0001 and H0002, 0943, 0944). Evidence gates (0877 S0010, 0892 S0011 `tooling/ledger-fresh.mjs`). RFC and ADR status lines. Conformance for the four freeze gaps (k.schema `format`, k.privacy `x-keel-pii`, k.hosting clause 2, k.shell clause 6).
- Written: `tasks/0963-to-p1/freeze-review.md`, `tasks/p1/PLAN.md`, `tasks/p1/weaknesses.md` (128 weaknesses in 21 fix lanes, in waves of two test-running lanes).
- golden-3 eval: ready short of the model call; it runs after W5 of the P1 plan (D13).
- Open from the lanes: k.shell's CI paragraph describes the workflow `keel build` generates for an app, not Keel's CI, so backlog 0948 is a misreading unless the generated workflow should change; `stripped()` in the server's `bearerOf` never changes a real request's value and can go; the 16 RFCs and 2 ADRs the status lane left unchanged (ten name `k.shell`, still `proposed`); `pnpm ledger --diff` cannot run locally without the apps' a11y reports.
- CI: `shell-ios` passed its boot with the 900 s bound and failed at the launch after the reboot; the launch is tried three times (84e212d6). `conformance/E1562-base-route-change.test.ts` took 158 s with two workers and passed; D7 is not shown to help, and the lasting fix is its 120 s limit under an `rfc:` change.

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
