# Workflow

**Unit of work.** One task from `tasks/BACKLOG.md`, sized to one context window, citing a spec section, with acceptance criteria.

**Loop.** `/next` (claim, worktree, branch, PLAN.md) -> `conformance-writer` writes tests from spec -> implement -> `pnpm check` -> `pnpm test` -> `/review` -> docs, spec status, changeset -> commit -> PR -> merge flips the backlog line.

**Batches.** When several tasks run in parallel subagents, the batch ends with the `reviewer` subagent over the batch diff (PRINCIPLES 1-12, VISION promises, Definition of done per RFC) and a `red-team` pass; their findings become backlog lines before the next batch starts, and the push waits for both.

**Parallelism.** Lanes work in place on one branch; a task that needs isolation takes a worktree under `.worktrees/`, and `HANDOFF.md` lists any active one. Same-package work is serialized. Agents stage nothing; the orchestrator commits by explicit path (never `git add -A`).

**Context discipline.** Checkpoint `PLAN.md` after each step. Subagents for exploration. `pnpm spec` for retrieval. Never read `.generated/` or build output.

**Brand.** `docs/BRAND.md` is the one style and voice guide. New apps start from the scaffold `project` template (brand tokens, self-hosted fonts, the mark); READMEs and docs pass `tooling/voice-lint.mjs`; the lockup goes on every public page.

**Format.** `pnpm check` runs `tooling/format-check.mjs` (F0001), which fails on any file in the repo that Biome would reformat, ignored generated paths aside. An agent formats only the files it edited, by path (`pnpm exec biome format --write <path>`), never a directory or the repo.

**Humans.** Approve RFCs and ADRs, own security, decide freezes, pick design partners.

**Point-in-time docs.** Every doc, README, spec sentence and code comment describes the present. History lives in git and `docs/rfc/`. Before the first public release the RFCs, ADRs, docs and comments are swept: superseded material goes, what remains describes 1.0, and the RFC process restarts from there for outside contributors.

**RFC defaults (user, 2026-11-09).** Design agents apply these and cite the one they used instead of asking; the orchestrator accepts the RFC. 1. A stdlib need that exposes a kernel gap is met by a kernel change (RFC, ADR, conformance, migration note), not a workaround. 2. One way per thing: a new API that duplicates an existing path either replaces it everywhere or is dropped. 3. Reuse the existing execution path (the test runner, the compiler, the check pipeline) unless the new path can replace it everywhere, in which case replace it. 4. Privacy by default: anything that leaves the browser or lands in a file, issue or log is redacted unless a schema or config marks it public; secrets never persist. 5. Server-only by default: config and data reach the client only through an explicit opt-in. 6. Prefer kernel-level enforcement to documentation when a guard is possible. 7. Budgets may be re-based with the reason in the commit; thresholds are never lowered. Escalate to the user only for: new hand-written user-facing API shapes, anything that weakens privacy or auth, external integrations (GitHub, npm, cloud), and anything needing a migration for an existing golden app.

**Lanes.** Stdlib stages run as lanes of disjoint packages under one orchestrator (`tasks/PROGRAM.md`): each stage opens with one design RFC, then implementation agents run in parallel per lane, one kernel agent per batch takes every kernel change, and the orchestrator owns the shared files (`spec/**`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`). Design RFCs for later stages may run ahead of implementation; implementation runs in stage order. Mutation runs go alone.

**Red team.** `red-team` subagent runs on schedule against merged work and PRINCIPLES.md, filing backlog items.

**Delegation.** The orchestrating agent keeps its context for thinking and decisions; it does not read code wholesale or do mechanical edits. Work is tiered by model and effort:

| Tier | Model / effort | Use for |
| --- | --- | --- |
| mechanical | haiku, high | scaffolds, renames, reading and summarizing, running commands, applying a known diff |
| routine | sonnet, medium | scripts, tooling, tests from a clear brief, conformance tests, reviews |
| design | opus, high (or the orchestrator) | kernel package design, spec interpretation, ADRs, anything with a judgment call |

Brief every subagent with: the files it owns, the files other agents own concurrently, the spec section, the verification command, and what to report back (trailer lines, files touched, unfinished items). Independent subagents run in parallel in one turn. Subagent definitions in `.claude/agents/` carry a `model:` so the tier is the default, not a choice.

verified: 20b896d74f32536582be575b89138930fe2a5b66
