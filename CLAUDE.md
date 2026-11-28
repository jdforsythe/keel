# Keel: agent instructions

You are building Keel. The repo is the memory; your context is a cache. Anything that exists only in your context is already lost.

**Read order on every fresh start:** `docs/HANDOFF.md` -> `docs/PRINCIPLES.md` -> `docs/GLOSSARY.md` -> `docs/ARCHITECTURE.md`. Load the `keel-architecture` skill. Run `/resume`. Do not read `spec/` or `docs/adr/` wholesale; `pnpm spec` lists the areas, `pnpm spec <area>` an area, `pnpm spec <id>` a section, `pnpm spec --for <code, name or term>` finds one.

**Commands:** `pnpm check` · `pnpm test` · `pnpm build` · `pnpm eval` · `pnpm spec <topic>` · `pnpm gate [<sha>]` (CI's jobs on this machine, before a push; `docs/GATE.md`). All emit compact structured output by default (see `docs/OUTPUT.md`); use `--format=pretty` only for a human.

**Rules**
1. One task per context window, unless the operator says otherwise: when told to keep working, close the task (`/handoff`), take the next unblocked backlog line and continue in the same context; make the decisions the work needs, record each in `PLAN.md` and `docs/HANDOFF.md` for the operator to confirm or reverse, and stop only for a real blocker. Done means the task's `PLAN.md` verification section is green.
2. Conformance tests are written by the `conformance-writer` subagent from the spec section before implementation. Never edit `packages/*/conformance/**` outside an `rfc:NNNN` PR.
3. Checkpoint `tasks/<id>/PLAN.md` after every step. Commit `wip:` early. Run `/handoff` at every stopping point and before any compaction.
4. Decisions go into `PLAN.md` or an ADR the moment they are made.
5. You are the orchestrator (`docs/WORKFLOW.md`, The orchestrator): decide, brief, review, merge, gate and write the handoff; the work itself runs concurrently in subagents and worktrees. Mind the shared machine. Exploration goes to subagents; their reading never enters your context. Delegate by tier (`docs/WORKFLOW.md` Delegation): haiku for mechanical work, sonnet for routine scripts and tests, opus or yourself for design. Run independent subagents in parallel.
6. No `any`, casts, non-null assertions, or `@ts-ignore` outside `unsafe/` directories; every `unsafe` use carries a justification string.
7. Everything you print, log, or emit follows `docs/OUTPUT.md`.
8. Never rename a glossary term. Propose an RFC.
9. Never use `--verbose` without stating why in `PLAN.md`.
10. Anything a person sees (README, site, example apps, inspector, scaffold output, docs copy) follows `docs/BRAND.md`: `brandTokens` from `@keel/ui/brand`, the marks in `docs/brand/`, and the voice rules; `pnpm check` runs the voice lint (V0003).

**Definition of done:** spec section cited · conformance green · property tests present · mutation score at threshold (`docs/TESTING.md`) · ledger not regressed · docs, spec status, changeset updated · budgets met · `unsafe` count unchanged or justified · `PLAN.md` closed · `tasks/BACKLOG.md` updated.
11. Documentation describes what exists now. No history in docs, READMEs, spec text or code comments ("used to", "since rfc:NNNN", "(backlog NNNN)"): the git log and `docs/rfc/` hold the story; task and RFC references belong in commit messages. Migration notes are the one exception. At the first public release the RFC and ADR sets are reset to describe 1.0 (`tasks/BACKLOG.md` 0229).
12. A reply to the operator is at most two sentences per event: what finished and what, if anything, needs them. Findings, lane detail and decisions go in `PLAN.md`, never in the reply; a direct question gets a direct answer of the length it needs.
