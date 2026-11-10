# Task 0219 batch: S1 leftovers (0219, 0237 remainder, 0248, 0255)

**Spec:** k.compiler (W1005, rfc:0077) · std.sessions (E2005, the action's issue lookup) · k.server (node-rendered page defaults, rfc:0078) · **Gate:** S1 leftovers, then S2 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10)

## Lanes (disjoint files; agents stage nothing; the orchestrator commits by path and owns `spec/00-map.md`, `tooling/budgets.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`)
- [ ] A std-sessions (sonnet): 0237 remainder (`require`, `import x = require()`, alias hops in E2005) and 0248 (issue lookup keyed on a hidden body marker, `state=all`, skip `not_planned`). Owns `packages/std-sessions/**`.
- [ ] B compiler (opus, kernel): 0219 W1005 on a manifest that spreads a std package's routes export. Owns `packages/compiler/**`, `spec/kernel/k.compiler.md`, `docs/rfc/0077-*`, `docs/adr/0066-*`.
- [ ] C server, ui (opus, kernel): 0255 node-rendered pages carry a title, the stylesheet and favicon, and a 404 page has content. Owns `packages/server/**`, `packages/ui/**`, `spec/kernel/k.server.md`, `docs/rfc/0078-*`, `docs/adr/0067-*`, `apps/sessions/**`.

## Steps
1. [ ] Three lane agents in parallel (launched 2026-11-10; A sonnet, B and C opus); each reports files touched, decisions, unfinished items.
2. [ ] Root `pnpm check`, `pnpm test`, `pnpm build`; ledger; budgets; unsafe 6.
3. [ ] Reviewer + red-team over the batch diff from 88e6479 (includes 0241); findings to `tasks/BACKLOG.md`; in-batch fixes.
4. [ ] Commit per lane (`rfc:NNNN` where conformance changed); push; backlog lines; `/handoff`.

## Decisions

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered, 0 uncovered; unsafe 6
- [ ] reviewer approved; red-team findings filed

## Next action
Step 1: collect the three lane reports (agents stage nothing: read `git status --short` if the reports are lost), then step 2.
