# Task 0337: S7 UI modules (std-headless, std-tables)

**Spec:** std.headless, std.tables (new) · k.ui, k.component (kernel touch) · **Gate:** S7 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S6 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0084 `docs/rfc/0084-s7-ui-modules.md` (draft cf453ef); finalizing with the user's answers and ADRs 0097-0102.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
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
Step 1: the design agent is writing `docs/rfc/0084-*.md`; read its report, then step 2.
