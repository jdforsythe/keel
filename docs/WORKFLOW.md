# Workflow

**Unit of work.** One task from `tasks/BACKLOG.md`, sized to one context window, citing a spec section, with acceptance criteria.

**Loop.** `/next` (claim, worktree, branch, PLAN.md) -> `conformance-writer` writes tests from spec -> implement -> the package's own `check` -> `pnpm test` -> `pnpm build` -> `/review` -> docs, spec status, changeset -> commit -> PR -> merge flips the backlog line.

**Batches.** When several tasks run in parallel subagents, the batch ends with the `reviewer` subagent over the batch diff (PRINCIPLES 1-12, VISION promises, Definition of done per RFC) and a `red-team` pass; their findings become backlog lines before the next batch starts, and the push waits for both.

**Conformance.** The `conformance-writer` writes suites from the spec section alone; builders never edit `packages/*/conformance/**`. An RFC unit lands as three commits: RFC and spec, conformance, build (`docs/RFC.md`). A case that looks wrong goes back to a conformance writer, who judges it from the spec; it is not patched by the builder. A conformance header quotes its clause whole, word for word as the spec prints it, in every file that asserts it; a paraphrased or halved clause leaves the ledger reading the clause as `none`.

**Parallelism.** Each lane works in its own worktree under `.worktrees/` on its own branch (`lane-<id>`), and `HANDOFF.md` lists the open ones. Lanes that touch one package are stacked, the later on the earlier. A lane's agents commit in the lane, never push, and stage by explicit path; the orchestrator does the same on the main line (never `git add -A`).

**Context discipline.** Checkpoint `PLAN.md` after each step. Subagents for exploration. `pnpm spec` lists the areas, `pnpm spec <area>` an area, `pnpm spec <id>` a section, `pnpm spec --for <code, name or term>` finds one. Never read `.generated/` or build output.

**Gates.** A brief tells its agent to run the package's own `check` (typecheck and lint, conformance included), not only the one test file it touched. The root `pnpm check` does not run the ledger diff; the orchestrator runs `pnpm ledger --diff` with the root gates, because CI's `ledger` job does. `pnpm gate` runs CI's jobs from `tooling/ci.source.json` on this machine for one commit before a push (`docs/GATE.md`).

**CI.** `tooling/ci.source.json` defines the jobs: `check`; eight `test-shard` jobs, to one of which every package must belong (`tooling/ci-shards.mjs`); a `test` job that passes only if every shard passed; `postgres`, `built-smokes` and `create-kit`; a `ledger` job that runs after the test jobs, reruns the example and library tests and checks the ledger and the evidence report; `build`, `budgets` and `golden-1-images`; `shell-tauri`, `shell-android`, `shell-tauri-macos` and `shell-ios`, which run when the `changes` job reports a shell change, the two macOS jobs only while the repository is public; `mutate-pr` on a pull request labelled `mutate`; and the weekly scheduled `eval`. Every job but `eval` has a time limit. Nothing is retried.

**Reference files.** The orchestrator keeps `tasks/STAGES.md` (each stage's verdict and evidence) and the evidence report current: `pnpm evidence:report` generates `tooling/ledger/evidence.json`, and with `--markdown` `tasks/COVERAGE.md` from it, and `pnpm coverage` measures line and branch coverage per package.

**Brand.** `docs/BRAND.md` is the one style and voice guide. New apps start from the scaffold `project` template (brand tokens, self-hosted fonts, the mark); READMEs and docs pass `tooling/voice-lint.mjs`; the lockup goes on every public page.

**Format.** `pnpm check` runs `tooling/format-check.mjs` (F0001), which fails on any file in the repo that Biome would reformat, ignored generated paths aside. An agent formats only the files it edited, by path (`pnpm exec biome format --write <path>`), never a directory or the repo.

**Doc freshness.** `pnpm check` runs `tooling/docs-freshness.mjs`, which fails D0001 when a doc has more than 50 commits to its subject since it last changed or since its `verified: <sha>`. A doc names its subject on a `subject:` line beside `verified:`: globs of the code and spec paths it describes, space separated, a path covering everything under it (`subject: packages/ui/src/brand* docs/brand/`). A package README's subject is its package's `src/` unless it names one. A doc under `docs/` with no `subject:` line ages on every commit to `docs/`, and W0014 says so on each run. A commit that touches only `docs/HANDOFF.md` ages no doc. To clear D0001, reread the doc against its subject, fix what changed, and set `verified:` to the commit read.

**Humans.** Approve RFCs and ADRs outside the RFC defaults below, confirm or reverse the ones an orchestrator accepted under them, own security, decide freezes, pick design partners.

**Point-in-time docs.** Every doc, README, spec sentence and code comment describes the present. History lives in git and `docs/rfc/`. Before the first public release the RFCs, ADRs, docs and comments are swept: superseded material goes, what remains describes 1.0, and the RFC process restarts from there for outside contributors.

**RFC defaults (user, 2026-11-09).** Design agents apply these and cite the one they used instead of asking; the orchestrator accepts the RFC. 1. A stdlib need that exposes a kernel gap is met by a kernel change (RFC, ADR, conformance, migration note), not a workaround. 2. One way per thing: a new API that duplicates an existing path either replaces it everywhere or is dropped. 3. Reuse the existing execution path (the test runner, the compiler, the check pipeline) unless the new path can replace it everywhere, in which case replace it. 4. Privacy by default: anything that leaves the browser or lands in a file, issue or log is redacted unless a schema or config marks it public; secrets never persist. 5. Server-only by default: config and data reach the client only through an explicit opt-in. 6. Prefer kernel-level enforcement to documentation when a guard is possible. 7. Budgets may be re-based with the reason in the commit; thresholds are never lowered. Escalate to the user only for: new hand-written user-facing API shapes, anything that weakens privacy or auth, external integrations (GitHub, npm, cloud), and anything needing a migration for an existing golden app.

**Lanes.** Stdlib stages run as lanes of disjoint packages under one orchestrator (`tasks/PROGRAM.md`): each stage opens with one design RFC, then implementation agents run in parallel per lane, each verifying its packages with `check` and `build`, one kernel agent per batch takes every kernel change, and the orchestrator owns the shared files (`spec/**`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`); the ledger is written only on a quiet tree, with in-progress spec edits set aside. Design RFCs for later stages may run ahead of implementation; implementation runs in stage order. Mutation runs go alone: they hold a machine-wide lock, and a second run fails E0010.

**Red team.** `red-team` subagent runs on schedule against merged work and PRINCIPLES.md, filing backlog items.

**Delegation.** The orchestrating agent keeps its context for thinking and decisions; it does not read code wholesale or do mechanical edits. Work is tiered by model and effort:

| Tier | Model / effort | Use for |
| --- | --- | --- |
| mechanical | haiku, high | scaffolds, renames, reading and summarizing, running commands, applying a known diff |
| routine | sonnet, medium | scripts, tooling, tests from a clear brief, conformance tests, reviews |
| design | opus, high (or the orchestrator) | kernel package design, spec interpretation, ADRs, anything with a judgment call |

Brief every subagent with: the files it owns, the files other agents own concurrently, the spec section, the verification command, and what to report back (trailer lines, files touched, unfinished items). Independent subagents run in parallel in one turn. Subagent definitions in `.claude/agents/` carry a `model:` so the tier is the default, not a choice.

**The orchestrator.** The session the operator runs `/resume` in is the director of the work: it understands the goals and moves the project to its end, done right, securely, with clean code and sound process. It keeps for itself the decisions, the briefs, the review of every lane's result, the merges, the gates and the handoff records (`PLAN.md`, `docs/HANDOFF.md`), so no work or progress is lost. Everything else runs concurrently in subagents at the tier above. A subagent's claim is checked before it is relayed or merged: the lane's tests and gates are run, and security work gets a reviewer pass and a red-team pass. A lane that must not disturb a build, an eval or a mutation run on the main tree works in its own git worktree and commits there; the orchestrator merges it when it is green (`tasks/0963-to-p1/briefs/README.md`, Merging a lane), and verifies the lane's merged head before the merge lands on the main line. A batch of many lines may go to one opus sub-orchestrator in a worktree that runs its own subagents.

**What the orchestrator decides.** It decides and records; it does not stop to ask. Each decision goes into the task's `PLAN.md` and `docs/HANDOFF.md` for the operator to confirm or reverse. It approves public API shapes, RFCs under the defaults and size budget re-bases (the measured size and the reason go in the commit). It brings to the operator: a security choice that does not follow plainly from the goals (fail closed, least surprise, enforce in the kernel), spending, and a mutation run. External reviews, the CI repair and full testing on devices belong to the pre-public readiness plan, not to stage work.

**Mutation on a shared machine.** A mutation run needs the operator's word. The light form, `pnpm mutate:stale`, runs only the files whose claim is stale, in chunks, with three test runners and a time bound, and is the one to ask for; the whole-package form takes the machine.

**Processes.** The machine is shared. A brief tells its agent to run one test file at a time, to run a whole package suite at most twice, to bound every command, and to leave no process behind. Several lanes running suites at once push load past what the cli suite's spawn-heavy files tolerate, so a lane is judged by the files it runs alone and the whole-suite verdict is the gate's. The orchestrator runs `pnpm orphans` before and after a batch and after any root run that stopped early: it lists this worktree's processes whose parent is gone (O0001), and `pnpm orphans --kill` ends them. Agents keep scratch files outside the repo. A mutation run is watched and stopped with `pnpm mutate:status` and `pnpm mutate:stop` only.

subject: CLAUDE.md .claude/ tooling/ci.source.json tooling/hooks/
verified: 460fd63e753712fdda4f21b1e016cbafcf07c8cf
