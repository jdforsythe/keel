# Task 0432: hand-build friction and browser findings, batch 1

**Spec:** k.server, k.forms, k.topology, k.ctx, k.router, k.head, k.runtime · **Principles:** 2, 5, 9 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 lanes of disjoint packages, run together: (1) server, forms: 0407 submitted secrets in `#k-state`; (2) cli, ctx: 0374 `keel dev` storage; (3) router: 0393 client `keel.notFound` default, 0382 E1505 import order; (4) golden-1 and its guide: 0384, the safe parts of 0386 and 0396; (5) runtime-dom: 0392 keyed `For` rows keep their element.
- D2 a lane that needs spec text or a conformance edit reports the wording; the orchestrator writes the RFC (WORKFLOW RFC defaults), the spec and briefs the conformance-writer.
- D3 left for a later batch because each needs a new API shape or a user answer: 0376, 0377, 0378, 0380, 0381, 0383, 0387, 0388, 0389, 0394, 0395, 0397, 0398, 0399, 0400.

## Steps
- [ ] 1 lanes 1 to 5
- [ ] 2 RFC, spec and conformance for what the lanes report
- [ ] 3 reviewer and red-team; findings to the backlog
- [ ] 4 ledger, budgets, backlog, handoff, push

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged

## Next action
Step 1 is running.
