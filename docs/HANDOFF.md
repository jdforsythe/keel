# Handoff (living)

Updated by `/handoff`. Read first on every fresh start. It holds the present state only; the git log and each task's `PLAN.md` hold the story.

```
health: pnpm check && pnpm test
active:
  - task: 0963-to-p1
    plan: tasks/0963-to-p1/PLAN.md
    list: tasks/p1/TODO.md (the road to public)
    branch: jdforsythe/test-impl
    worktree: this Orca worktree (test-impl); pull request 4 into master at https://github.com/jdforsythe/keel (public)
  - state: Read the plan's last ten checkpoints (243 to 253 and after) and `## Next action` first; decisions D206 to D226 are of this session. CI is green on the pushed head 05213d92f. Merged since then and unpushed: a scaffold test-setup fix and `lane-lib-installed`; `lane-gate6` regenerates the ledger for that push (merge it, run the doc lints, push, watch CI). Merged and pushed this session: RFC 0243 (`lane-r-look`), RFC 0246 (`lane-r-map`), the time rule (`lane-time-gaps`), `lane-testing-fixes`, `lane-tooling-fixes`.
  - merge order (D221): RFC 0242 `lane-r-defect`, then RFC 0245 `lane-server-up`, then RFC 0251 `lane-r-boundary`, then RFC 0248 `lane-r-sessions`. Independent of that chain and mergeable when their reviews pass: RFC 0244 `lane-r-e2e`, RFC 0247 `lane-r-create`, RFC 0249 `lane-r-themes`, RFC 0255 `lane-r-fresh`.
  - lanes, each state as of this handoff (an agent of an earlier session cannot be resumed: read the lane's `git log` and `git status --short`, then brief a finisher from the plan's checkpoint for it and `tasks/0963-to-p1/briefs/`):
      lane-r-defect (RFC 0242): redesigned on the wall test (D224, D226: `attempt(fn, expect)`, `Result` never nested, literal `defect`, no thrown text in production logs, identity by a kernel record, shared module state refused during a request). Spec done; conformance first pass done, second pass was running. Next: a builder for the redesign (delete the old fixes, symbol-key marks, `Secret` statics, the PGlite text match; migrate about 150 `attempt` calls and 40 `defect` messages), then a breaking review whose acceptance test is the wall test. Its `tooling/budgets.json` holds two token limits raised by a merge (see needs a person).
      lane-server-up (RFC 0245): restated in layers (D222, D223); conformance for the layered spec written; no builder started: it waits for RFC 0242's model to be built, then builds (the reading rule, error observers, islands for any page work, `@keel/ctx/sim`), then a final review.
      lane-r-boundary (RFC 0251): slice 2 built through step 5; conformance re-based; a new builder waits until RFC 0242 and RFC 0245 are on the main line (D221), then merges the main line, replaces the lane's own `task(fn)` with RFC 0245's `task`, fixes the six product defects in checkpoint 242, builds steps 6 to 11, then a breaking review. `lane-r-device` (RFC 0256, written) branches from it.
      lane-r-sessions (RFC 0248): stateless tickets held their third review (checkpoint 253); a builder was fixing its findings (the slot charged before the body is read, docs, `createApp` taking ticket code as an option). Then a conformance re-quote, and it merges after `lane-r-boundary` clears E1513 and E1152.
      lane-r-e2e (RFC 0244): three parts built; a builder was building local routes (D225) and the sandbox clauses, re-running the inspector reproduction and verifying the lane whole; then a last review.
      lane-r-create (RFC 0247): built; review's first five findings fixed; a builder was on the rest (a route's path from its id, no server loader in a client-only app, minors). The harness flagged one of its commands as an irreversible local deletion; the main checkout, all worktrees and branches were checked intact; its answer on what it removed had not arrived: check its report. Then a conformance re-quote (about twenty stale cases) and a second review. Its `create-kit` line in `tooling/gate-plan.mjs` needs the operator's yes.
      lane-r-themes (RFC 0249): built, merged with the main line; 41 of 43 package suites green; an integrator was finishing apps, build, smokes and gates. Then five conformance re-quotes and a breaking review. `lane-r-motion` (RFC 0252, written) branches from it.
      lane-r-fresh (RFC 0255): spec and conformance done; a builder was on slices 1 and 2 (slice 3 waits for RFC 0251's evaluator).
      lane-std-formats (RFC 0239): ready since before; merges after RFC 0242. lane-std-sessions: carried inside lane-r-boundary.
      finished and safe to remove after a look: lane-gate4, lane-gate5, lane-r-look, lane-r-map, lane-testing-fixes, lane-time-gaps, lane-tooling-fixes, lane-lib-installed, `.worktrees/verify`.
  - owed and not started: RFC 0256 conformance and build (device libraries), RFC 0257 (head API) and RFC 0258 (images), RFC 0252 conformance (after RFC 0249 and RFC 0245 merge), RFC 0253 and RFC 0254 reserved; `topology` out of `@keel/server`; a size review of `@keel/check` (about 104 KB); `docs/freeze-review.md` needs a real recount (D0001 in several lanes); `docs/VISION.md` and `docs/PRINCIPLES.md` to be checked whole (three lanes moved their `verified:` line).
  - how an RFC is built here: writer, conformance-writer from the spec text alone, builder, conformance-writer on disputes, a reviewer who tries to break it as a persona (`tasks/p1/personas.md`), then the writer closes the findings and the loop repeats; after two rounds of patches a design is restated at its root (D202, D210, D222, D224). Rules in `tasks/0963-to-p1/briefs/README.md`: done right before done; a Conformance list is `- ` bullets; token limits never raised; builders never edit conformance or `tooling/budgets.json`; waiting and teardown; docs freshness.
  - how the orchestrator works (D191, D193): up to five opus subagents and seven in all, one fable for deep design; slots refilled from a queue; one sentence per event to the operator; decisions recorded and standing unless the operator objects; questions asked in conversation, never by pointing at a file.
  - first thing on resume: `git worktree list`, `git status --short`, `gh run list --branch jdforsythe/test-impl --limit 2`, `git log --oneline origin/jdforsythe/test-impl -1`; then each lane's `git log --oneline -5` against this list; then the plan's last checkpoints.
  - safe to clear: only when the plan's last checkpoint says no agent is running. Lane commits survive a clear; an agent's unreported work does not.
blockers: none
needs a person: (1) may the orchestrator restore `spec.map` to 400 and `docs.map` to 900 in `tooling/budgets.json` on `lane-r-defect` (a merge raised them to 1660 and 1690 by the orchestrator's own brief; the builder's edit back was refused by the permission system, so it is not made without the operator's word); (2) the `create-kit` job added to `tooling/gate-plan.mjs` by `lane-r-create`; (3) the licence for published packages, if the create lane reports none is decided; (4) decisions D206 to D226 stand unless reversed: the ones that change what an author writes: D226 (`attempt` requires `expect`), D218 (`defineTokens` from `@keel/ui/tokens`), D216 (`keel dev --host`), D219 (no page signal), D215 and D217 (device libraries and two more RFCs before public).
last updated: 2026-11-27
```

## Reading on resume
Read this file and the active plan, then act. Do not read `tasks/0338-s8-reach/PLAN.md`, `tasks/BACKLOG.md`, `spec/` or `docs/rfc/` whole: the active plan says how to fetch one decision, one backlog line or one section. Subagents read what their step needs.

## Running things for a person
`pnpm --filter golden-2 dev` serves golden-2 with a dev sign-in fixture (port 5173; never port 8080). A built app: `pnpm --filter golden-<n> build`, then `dist/api/server.mjs` with `PORT`, `KEEL_SECRET` and, for golden-2, `BETTER_AUTH_SECRET`.

subject: tasks/
