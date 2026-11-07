# Task 0121: brand applied everywhere

**Spec:** docs/BRAND.md (user-supplied design guide, 2026-11-07) · **Gate:** G3 · **Branch:** jdforsythe/test-impl · **Status:** open · **Evidence:** docs/BRAND.md, docs/brand/*.svg

## Deliverables
- [x] docs/BRAND.md and docs/brand/{keel-mark,keel-logo-lockup}.svg stored verbatim from the design agent
- [ ] `@keel/ui/brand` exports `brandTokens`; `@keel/ui/fonts` self-hosts Source Serif 4 and JetBrains Mono (no third-party runtime fetch)
- [ ] golden-1, golden-2, inspector restyled on brandTokens; evals/tasks/golden-2 pass.ts still green
- [ ] scaffold `project` template emits brand tokens, fonts link, mark
- [ ] root README with the lockup and the voice rules; voice lint V0003 in `pnpm check`; existing banned words fixed
- [ ] CLAUDE.md rule 10 and WORKFLOW.md Brand paragraph (process)

## Steps
1. [x] Guide and marks written; memory saved; CLAUDE/WORKFLOW/backlog updated.
2. [ ] Two agents: ui+apps (opus), scaffold+README+voice-lint (sonnet).
3. [ ] Restart the four app processes (4180/4181 golden-1, 4190/4191 golden-2) on the new build; user reviews.
4. [ ] Commit, push, handoff.

## Decisions
- D1: Fonts are self-hosted under packages/ui/fonts (SIL OFL), never fetched from a CDN (THREAT-MODEL CSP).
- D2: ISO Ochre is used only for status badges, active diagnostics and conformance rungs, per the guide.
- D3: golden-2 stays the eval-built artifact; the restyle changes tokens and style props only, behaviour and tests untouched.

## Verification
- [ ] `pnpm check` (incl. voice-lint) and `pnpm test` green; `node tooling/budgets.mjs` ok (ui 4kb JS bundle)
- [ ] Both golden apps and the inspector render on brand in the browser

## Next action
Step 3 after the agents report.
