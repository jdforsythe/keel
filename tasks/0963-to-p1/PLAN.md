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

## Method
- RFC unit: RFC, spec and ADR; then conformance by the `conformance-writer` from the spec; then the build. Conformance and build run in their own git worktree and branch, merged when green, so red tests never sit on the main line.
- Before a push: `pnpm check`, `pnpm test`, both apps' `keel test`, `pnpm ledger --diff`, `node tooling/evidence-report.mjs --check` and `pnpm build` on the exact commit in a clean checkout, each gated on its own exit status. `pnpm ledger` and `pnpm evidence:report` are written from a clean tree after both apps' `keel test`.
- One mutation run at a time (machine-wide lock). Few test-running agents at once: the machine is shared, and spawn-heavy cli conformance times out under load (backlog 0938).

## Verification
- [ ] Backlog 0956 built and conformance-covered.
- [ ] Backlog 0921: the server's mutation run finishes; findings in `tasks/0338-s8-reach/proposed/server-mutation-tail.md` acted on.
- [ ] Backlog 0961: a session proven in the macOS Tauri shell and the iOS shell.
- [ ] golden-3 built by an agent run of its eval; the eval converges.
- [ ] Freeze review (backlog 0034): every kernel section conformance-covered, the `frozen` flip prepared for P1.
- [ ] P1 and P2 plan written from `tasks/p1/INPUT.md` (backlog 0962).

## Next action
Check the two agents in flight (see `docs/HANDOFF.md`, in flight), review and push their commits, then take backlog 0956.

1. In flight: backlog 0921 (server mutation tail) and backlog 0961 (automated shell session proof). Each commits to the main line and writes its findings to a file in the repo; review, gate in a clean checkout, push.
2. Backlog 0956: RFC amendment to `k.return` (a return link is accepted only while the shell has opened the external browser from a mount redirect, once), conformance, build, threat model.
3. golden-3 by agent eval (`evals/tasks/golden-3`; the first step with model calls; the runner's default is `none`, an agent run names a model). Its `browser.ts` needs a sign-in secret (backlog 0937).
4. Freeze review (backlog 0034) and G3.
5. The P1 and P2 plan (backlog 0962), in a context of its own.
