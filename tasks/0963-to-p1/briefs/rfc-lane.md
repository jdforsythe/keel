# Brief: an RFC writing lane

You write one design RFC for Keel, with its ADR and spec text, on a lane branch in your own git worktree. Writing only: no package source, no tests, no conformance files.

## Read first, in this order, and nothing wholesale beyond it
- `CLAUDE.md`, `docs/PRINCIPLES.md`, `docs/GLOSSARY.md`, `docs/ARCHITECTURE.md`.
- The decisions your prompt names: `grep -n "^- D<n> " tasks/0963-to-p1/PLAN.md`. They are the operator's and are not reopened; where a decision says "the orchestrator's proposal", you may improve it and say why.
- Your workstream in `tasks/p1/PLAN.md` (`grep -n "^### W" tasks/p1/PLAN.md`).
- The form: `.claude/commands/rfc.md`, and the latest pair as a model, `docs/rfc/0155-client-source-maps-not-served.md` with `docs/adr/0177-client-source-maps-not-served.md`.
- Spec sections with `pnpm spec <area>` and `pnpm spec <id>`, one at a time; older RFCs and ADRs one file at a time. Read the code your design touches: an RFC that misstates what exists is rejected.

## What you deliver, committed on your branch
1. `docs/rfc/<NNNN>-<title>.md`: Problem, Proposal, Alternatives, Spec diff, Conformance diff (the bullets the conformance-writer will turn into tests, each one checkable from the spec text alone), migration, and what it costs (size budgets, section token limits, the spec map row).
2. `docs/adr/<NNNN>-<title>.md`.
3. The spec text applied in `spec/`, status `proposed`. Sections have size limits and an area has a token budget (`pnpm check` reports them): a full section gets a new section, never a raised limit; a new section adds one row to its area file `spec/areas/<area>.md`, and an area at its budget splits in two; no title is shortened. New diagnostics take free codes; check `pnpm spec --for <code block>` and the code table before choosing.
4. Every open question you could not settle from the decisions, listed at the RFC's end under "For the operator", each with your recommendation. Decide everything else yourself and state it.

## Rules
- Never rename a glossary term. New terms are proposed in the RFC and added to `docs/GLOSSARY.md` in the same commit.
- Docs and spec say what is, with no history ("used to", "since rfc:NNNN"). The RFC's Problem section is where the present state is described.
- `docs/BRAND.md` voice applies; `pnpm check` runs the voice lint.
- The design must hold to the principles: prove it against the worked cases your prompt names, with real code samples in the RFC that would type-check under the proposal.
- Run `pnpm check --quiet` before each commit. The ledger gate may fail because spec text has no conformance yet; every other gate passes. Do not run `pnpm test`.
- Commit as `rfc:<NNNN> ...` with small commits. Do not push. Do not touch other worktrees.
- Your final report, at most 400 words: the commits, the design in ten lines, the questions for the operator with recommendations, what the conformance and build lanes need to know, and anything in the tree that contradicts the decisions.
