# Task 0121: brand applied everywhere

**Spec:** docs/BRAND.md (user-supplied design guide, 2026-11-07) · **Gate:** G3 · **Branch:** jdforsythe/test-impl · **Status:** closed (2026-11-07, commit 4084e6c) · **Evidence:** docs/BRAND.md, docs/brand/*.svg

## Deliverables
- [x] docs/BRAND.md and docs/brand/{keel-mark,keel-logo-lockup}.svg stored verbatim from the design agent
- [x] `@keel/ui/brand` exports `brandTokens`; `@keel/ui/fonts` self-hosts Source Serif 4 and JetBrains Mono (no third-party runtime fetch)
- [x] golden-1, golden-2, inspector restyled on brandTokens; evals/tasks/golden-2 pass.ts still green
- [x] scaffold `project` template emits brand tokens, fonts link, mark
- [x] root README with the lockup and the voice rules; voice lint V0003 in `pnpm check`; existing banned words fixed
- [x] CLAUDE.md rule 10 and WORKFLOW.md Brand paragraph (process)

## Steps
1. [x] Guide and marks written; memory saved; CLAUDE/WORKFLOW/backlog updated.
2. [x] Two agents: ui+apps (opus), scaffold+README+voice-lint (sonnet).
3. [x] Restart the four app processes (4180/4181 golden-1, 4190/4191 golden-2) on the new build; user reviews.
4. [x] Commit, push, handoff.

## Decisions
- D1: Fonts are self-hosted under packages/ui/fonts (SIL OFL), never fetched from a CDN (THREAT-MODEL CSP).
- D2: ISO Ochre is used only for status badges, active diagnostics and conformance rungs, per the guide.
- D3: golden-2 stays the eval-built artifact; the restyle changes tokens and style props only, behaviour and tests untouched.

## Verification
- [x] `pnpm check` (incl. voice-lint) and `pnpm test` green; `node tooling/budgets.mjs` ok (ui 4kb JS bundle)
- [x] Both golden apps and the inspector render on brand in the browser

## Files touched
packages/ui (brand, fonts, border token group, classesOf), packages/compiler collectStyles (border prop), packages/scaffold templates + project-brand test, apps/golden-1, apps/golden-2, apps/inspector, README.md, tooling/voice-lint.mjs, package.json check line, docs/BRAND.md, docs/VOICE.md, docs/brand/*.svg, CLAUDE.md, docs/WORKFLOW.md.

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1352 files` · `ok budgets 46 measured` · `ok ledger --diff 390 items, 346 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Open questions
- Fonts: Source Serif 4 roman is 429 KB (OFL forbids subsetting under the reserved name); italics not shipped. Mono ligatures cannot be disabled through typed props yet.
- `fonts.css` sets the page background and zero body margin because k.ui has no page-level token; consider a `page` token group.

## Next action
None; closed. User reviews http://localhost:4180/ and http://localhost:4190/.
