# Task 0337: S7 UI modules (std-headless, std-tables)

**Spec:** std.headless, std.tables (new) · k.ui, k.component (kernel touch) · **Gate:** S7 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open; implementation started 2026-11-13 (S5 and the S6 batch pushed)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0084 `docs/rfc/0084-s7-ui-modules.md` accepted (ADR-0097 to ADR-0102; k.head holds the one focus rule).
2. [x] Orchestrator accepts the RFC; user answered D2-D4.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead; implementation runs in stage order.

- D2 (user, 2026-11-11): API shapes accepted as a set (std-headless seven widgets with chart-instance interaction state and app-owned values; std-tables with schema-derived columns, query in the route search, one `applyQuery`; k.aria `Part` closed to app code by E1822; slots as props; search-only pushes keep scroll).
- D3 (user, 2026-11-11): golden-2 gains `recipes.catalog` for the exit proof.
- D4 (user, 2026-11-11): virtual rows deferred; paging ships in S7.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 2a, orchestrator prep, started 2026-11-13. Running: one spec agent writing RFC 0084's Spec diff into `spec/` rebased on the tree after S5, S6 and RFCs 0093-0096 (k.aria, std.headless, std.options, std.tables new; k.ui, k.component, k.a11y, k.testing, k.router, std.statecharts edited; the map at its 1,200-token cap); nothing of it is committed until it reports: `git status --short spec` shows its in-flight edits. When it reports: record its deviations as D5 here, commit as `rfc:0084 spec: ...`, then the package prep from RFC 0084 "Lanes" (skeletons `packages/std-headless`, `packages/std-tables` in the std-statecharts shape, `tooling/deps.json`, budget entries, golden-2 dependencies, one `pnpm install`), then conformance-writers per lane (each header quotes its clause verbatim with raw `"`; new tests `test.skip` until implementation; fixtures need accessible names because the harness runs axe-core), then the lanes (kernel first; headless, tables, golden-2), agents committing their own paths with `rfc:0084 <lane>:` prefixes, budgets re-based with measured bytes after the lanes, root gates (stop orphaned `keel dev` children), ledger on a quiet tree, reviewer and red-team, fixes, push, the exit-proof eval. How S5 and S6 ran is in tasks/0311-s5-correctness/PLAN.md and tasks/0312-s6-compliance/PLAN.md. Sections near their cap today: k.server 3 tokens left, k.compiler 2, k.security 7, k.cli 8, k.deploy fine. Machine rules: few test-running agents, one test file at a time, never the root `pnpm test` from an agent, no mutation without asking the user.
