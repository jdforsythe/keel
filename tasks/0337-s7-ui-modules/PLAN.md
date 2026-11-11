# Task 0337: S7 UI modules (std-headless, std-tables)

**Spec:** std.headless, std.tables (new) · k.ui, k.component (kernel touch) · **Gate:** S7 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S6 pushes

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
Waits for the S2-S6 pushes. Then: orchestrator prep per RFC 0084 "Lanes" (k.aria, std.headless, std.options, std.tables; k.ui/k.component/k.router/k.testing/std.statecharts edits; skeletons std-headless, std-tables; deps; budgets), conformance-writers, implementation batch (kernel + headless, tables, golden-2 lanes).
