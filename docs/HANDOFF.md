# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    list: tasks/p1/TODO.md (the road to public: what is in, running, next, blocked, and what needs a person)
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: Read the plan's last five checkpoints and `## Next action` first. CI is green on the pushed head 2417d71b5 (RFC 0241, its ledger, 73 of 83 kernel sections conformance-covered by the spec's status lines). On the main line and unpushed: the `slow-shards` gate job, the time rule (default test and hook timeouts are fixed time), the evidence verifier's message, conformance helper fixes; `lane-gate4` runs one whole gate on it. The day's work is a set of RFC lanes, each going writer, conformance-writer, builder, a reviewer who tries to break it, then fixes: the plan's checkpoints 145 to 195 hold each one's state. Three reviews found that what `keel check` judges was not what gets loaded and run; RFC 0251 (D204) fixes that at the root.
  - lanes, each with a clean tree unless an agent is in it: `lane-std-formats` (`.worktrees/std-formats`: twelve stdlib packages on the format, RFC 0239; integrated and ready, waits for the push and for RFC 0242's `defect`); `lane-std-sessions` (RFC 0240 both parts; not merged by itself: `lane-r-boundary` carries it forward); `lane-r-boundary` (RFC 0251 slice 1 built; a builder fixes one gap, then a reviewer); `lane-r-sessions` (RFC 0248: tickets and a write-only archive; a builder builds the review's fixes); `lane-r-defect` (RFC 0242: `defect`, module roots; a builder builds the second part; `unsafe` goes from 33 to about 16); `lane-r-look` (RFC 0243: library tokens, schemes, roles, the value grammar; a builder on the last fixes, then the merge); `lane-r-themes` (RFC 0249 written; conformance being written); `lane-r-motion` (RFC 0252 written); `lane-r-e2e` (RFC 0244 built; its writer settles dropped assertions); `lane-r-map` (RFC 0246 built and green; waits on a size re-base); `lane-server-up` (RFC 0245 built, integrated; one gap: a shared module's top-level `task` on a server); `lane-testing-fixes` (green; waits on a size re-base); `lane-gate4` (the gate run). `lane-app-trials`, `podcast-script` and `lane-r188` as before.
  - how an RFC is built here: a writer (RFC, ADR, spec text), then the `conformance-writer` from the spec text alone, then a builder, then the conformance-writer to judge every case the builder disputes, then a reviewer who tries to break it as the persona it exposes most (`tasks/p1/personas.md`), then the writer closes what the review found in the spec and the loop repeats, then an integrator merges the main line in and runs every package suite, then the merge. `tasks/0963-to-p1/briefs/` holds what each is told. Every reviewed lane so far had real holes.
  - how the orchestrator works (the plan's D191, D193): director of engineering and PM; done right before done: no lane weakens a guarantee, a score, a limit or the public surface to get through, and a shortcut is sent back; up to five opus subagents and seven in all when two are sonnet; a slot is refilled from the queue when it frees; one or two sentence updates between events; questions held until the operator writes; a status answer is what is left to public.
  - the gate before a push is `pnpm gate [<sha>]` (`docs/GATE.md`), with `slow-shards` last; this machine under seven agents cannot judge it at scale 0.1, so a whole gate runs in a quiet window and CI is the arbiter (D201). `ledger-fresh` and `evidence-report --check` are judged in a clean or freshly run checkout, never in the main worktree, whose run reports are stale. A CI-only failure is reproduced in a CPU-constrained container before a fix is pushed; a container never bind-mounts a path under the main checkout.
  - first thing on resume: `git worktree list`, `git status --short`, `gh run list --branch jdforsythe/test-impl --limit 2`, `git log --oneline origin/jdforsythe/test-impl -1`, then the plan's last five checkpoints and `## Next action`, then `tasks/p1/TODO.md`. A subagent of an earlier session cannot be resumed: read an open lane's `git log` and `git status --short`, then brief a finisher from the lane's last checkpoint and `briefs/`.
  - safe to clear: NO while agents run (the plan's last checkpoint names them); a lane's commits survive, an agent's context does not.
blockers: none
needs a person: (1) the permission system refuses a subagent's edit of `tooling/budgets.json`: size re-bases wait for the operator's word (`@keel/testing`, `@keel/cli/docs`, `@keel/check` and others: the plan's checkpoints 158, 173, 186, 190, 195 list the numbers); (2) the `keel` binary name, which another product also ships; (3) two lines to confirm for CLAUDE.md's read order and principle 8 (checkpoint 158). The rest of `tasks/p1/TODO.md`'s "Needs a human" is unchanged.
decisions to confirm or reverse, each recorded in the plan: D182 to D205 of 2026-11-25 and 26 (among them D192 the `unsafe` count comes down; D194 and D197 floating promises refused at check and `task` as the owner of browser work; D195 and D198 `defect`, no `throw` inside `unsafe`, type predicates that do not prove their type count as escapes; D199 session recordings write-only behind a signed ticket; D200 themes; D203 motion; D204 the trust boundary; D205 a design mode in `keel dev`); and the earlier D19 to D181 as the plan lists them.
last updated: 2026-11-26
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.

subject: tasks/
