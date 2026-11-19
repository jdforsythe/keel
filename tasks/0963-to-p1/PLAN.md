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

- D18 (2026-11-19, operator): the return-link design, replacing D3, D8 and the tap rule of RFC 0150. (1) A link to a page always opens it: the app's scheme is a general deep link, with the exposure of a web link. (2) A link to a path under the identity mount is accepted while an opening is pending (OAuth returns), or at any time when the app has declared that path as safe to receive from outside (a magic-link or verify-email callback); every other mount path is refused. (3) A sign-in that an incoming link set off, until a person next acts, records no opening, so its return is refused; a sign-in auto-started at an ordinary launch or by a tap works. A cold start whose launch is itself a link counts as link-triggered.

- D19 (2026-11-19): the std-sessions suite removes the notes fixture's `.keel` when it ends (`test/removeFixtureArtifacts.ts`, a vitest global setup). A group user writes compiler artifacts beside the fixture's Vite config; left on disk they read as a project of the workspace, so the committed ledger held 80 `a11y:notes.*` items a clean checkout lacks, and CI's `check` failed S0011 on a1df93cd (its `test` job failed only because the shards were skipped). A stale `packages/std-sessions/.stryker-tmp` sandbox doubled them and was deleted. The ledger command is left as the spec states it (every `routes.json` is a project); a ledger written on a machine with a mutation sandbox or a fixture's artifacts on disk is wrong, which is why the Method writes it from a clean checkout.

- D20 (2026-11-19): weakness lane 01 is merged (RFC 0148 and 0149, ADR-0170 and 0171). The `@keel/std-offline` size budget moves from 3.5 kB to 3.7 kB (3,759 B measured): the per-ctx outbox state and the same-seed and drain-end fixes of its red-team pass. Backlog 0800 stays open and needs an RFC.

## Method
- RFC unit: RFC, spec and ADR; then conformance by the `conformance-writer` from the spec; then the build. Conformance and build run in their own git worktree and branch, merged when green, so red tests never sit on the main line.
- Before a push: `pnpm check`, `pnpm test`, both apps' `keel test`, `pnpm ledger --diff`, `node tooling/evidence-report.mjs --check` and `pnpm build` on the exact commit in a clean checkout, each gated on its own exit status. `pnpm ledger` and `pnpm evidence:report` are written from a clean tree after both apps' `keel test`.
- One mutation run at a time (machine-wide lock). Few test-running agents at once: the machine is shared, and spawn-heavy cli conformance times out under load (backlog 0938).

## Lanes (2026-11-19)
Each lane is a subagent in a worktree under `.worktrees/` (created by the orchestrator from the current head with `git worktree add` and `pnpm install --frozen-lockfile --prefer-offline`; the Agent tool's own isolation starts from `master` and is not used), committing on its branch; the orchestrator reviews, cherry-picks, and removes the worktree. Security lanes get a red-team pass before the merge; a red-team brief says findings go in the report, not the backlog.
- `.worktrees/w03`, branch `lane-w03`: the return-link design of D18. The spec rewrite of RFC 0150 is committed there (915ded3e: RFC 0150 and ADR-0172 renamed `links-into-a-shell`, a new section `k.links`, `k.return`, `k.opening`, `k.mount` at exactly its 6,000-character limit, the threat model). Its shape: `identityMount('/api/auth', { links: ['/magic-link/verify', '/verify-email'] })` declares the mount paths any link may open, checked by E1584; the shell reports its launch once (links, none, or a failed read) and an opening made with no person's act is held until then. Next on that branch: conformance by the `conformance-writer` from the RFC's Conformance diff (three bullets move word for word from `k.return` to `k.links`, two reverse, three are removed, nine are added; existing `return-*` files change under `rfc:0150`), then the build (the `wip:` commit 1334ca3c holds act detection to reuse and puts `packages/testing` 378 bytes over its 13.5 kB budget; the READMEs, the keel-testing skill, changesets and an E1584 explanation are the build lane's), a red-team pass, the merge, then the ledger and evidence. Two questions it leaves, both the orchestrator's to decide: a development warning when a link-started chain opens the browser, and whether a std auth adapter supplies its library's safe `links`. Until it merges the main line carries the stricter RFC 0147 behaviour.
- `.worktrees/w08`, branch `lane-w08` (weakness lane 08, supply chain; three commits): held. Verify `pnpm install --frozen-lockfile` under pnpm 11.17.0 in that worktree (possible after 21:10 UTC on 2026-11-19, when pnpm's release-age rule admits a dependency published the day before; the lockfile entry for the inspector app was written by hand), then merge and watch the CI run, since it moves CI to `pnpm/action-setup` v6 and pins every action by SHA.
- Dispatched 2026-11-19 20:20 UTC, each a background subagent committing on its branch, none pushed:
  - `.worktrees/w03` `lane-w03`: the RFC 0150 conformance (conformance-writer). Then the build.
  - `.worktrees/w5l1` `lane-w5l1`: W5 lane L1, the `keel docs` RFC with the k.cli and k.scaffold spec diffs (opus, writing). Its spec text stays on the lane until conformance exists (D12). The skill lanes and L2 wait for the operator's word on ADR-0173.
  - `.worktrees/w09` `lane-w09`: weakness lane 09, threat model (opus, writing).
  - `.worktrees/w05` `lane-w05`: weakness lane 05, check and std-text (sonnet, tests).
  - `.worktrees/fz` `lane-fz`: freeze blockers 5, 10, k.hosting's status, backlog 0948; reports on the drifted headers (item 9) and writes `tasks/0963-to-p1/assumptions-triage.md` (item 6).
  - `.worktrees/verify`: a detached clean checkout for the pre-push gate; remove it after use.
- Merged today: weakness lane 01 (std-offline and std-channels; D20); RFC 0147 (`k.return`, `k.opening`); the freeze conformance gaps; release hygiene; the evidence gates; RFC and ADR status lines; the server's mutation tests and the std-sessions mutation config; weakness lane 02 (server scrub); ADR-0173 and `tasks/p1/w5-agent-docs.md`.
- Not started, ready to dispatch (the operator wants more lanes at once; at most two or three test-running lanes, any number of writing lanes):
  - W5 wave 1 from `tasks/p1/w5-agent-docs.md`: the RFC for `keel docs`, docs packing, and seven skill lanes (Markdown only). golden-3 is built by an agent run only after W5 (D13), in the eval's public mode.
  - Weakness lanes 03 to 21 of `tasks/p1/weaknesses.md`, in its waves; lane 03 (router) after `lane-w03` merges; lane 09 (threat model) is writing only.
  - Freeze blockers of `tasks/0963-to-p1/freeze-review.md` still open: k.shell (`proposed`), k.hosting's status flip now that clause 2 has conformance, the 12 drifted headers, the assumption lines, backlog 0974.
  - Mutation runs of server and std-sessions, one at a time, on a quiet machine.
- Open notes: backlog 0948 is a misreading (k.shell's CI paragraph describes the generated app workflow); `stripped()` in the server's `bearerOf` never changes a real request's value; `pnpm ledger --diff` needs both apps' `keel test` reports on disk; the docs-freshness rule fires after 50 docs commits, so a busy day needs `verified:` stamps on untouched docs; `conformance/E1562-base-route-change.test.ts` sits at its 120 s limit on slow runners (D7 did not clearly help; the fix is the limit, under an `rfc:` change); a full local `pnpm test` times out cli conformance while three lanes run tests, so run it when lanes are quiet.

## Verification
- [ ] Backlog 0956 built and conformance-covered. RFC 0147, ADR-0169, k.return and the threat model are written (k.return is `implemented` until its conformance lands); next the conformance lane, then the build, each in a worktree.
- [x] Backlog 0921: the server's mutation run finishes (78.4 against 70); findings in `tasks/0338-s8-reach/proposed/server-mutation-tail.md`; follow-ups are backlog 0966 and 0967.
- [ ] Backlog 0961: a session proven in the macOS Tauri shell and the iOS shell (done locally by automation; the hosted-runner run is backlog 0965).
- [ ] golden-3 built by an agent run of its eval; the eval converges.
- [ ] Freeze review (backlog 0034): every kernel section conformance-covered, the `frozen` flip prepared for P1.
- [x] P1 and P2 plan written from `tasks/p1/INPUT.md` (backlog 0962): `tasks/p1/PLAN.md`; the operator reads its open decisions O1 to O11.

## Next action
1. `git worktree list`, then the CI run on the pushed head (`gh run list --limit 2`); fix what fails.
2. `lane-w03`: read the spec rewrite's commit message, dispatch its conformance, then the build and a red-team pass (see Lanes).
3. Merge `lane-w01` (see Lanes), then verify and merge `lane-w08`.
4. Dispatch widely, in one turn: W5 wave 1, the next weakness wave, lane 09, the freeze blockers.
5. Questions for the operator are asked in conversation with an explanation and a recommendation, and only when they change the direction.
