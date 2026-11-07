# Task 0035: size budgets measure an esbuild bundle

**Spec:** k.check Budgets (`budgets.json`: gzip size per package) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Status:** closed (2026-11-06) · **Evidence:** `tooling/budgets.mjs`, `node tooling/budgets.mjs`

## Deliverables
- [x] `tooling/budgets.mjs` size section bundles `packages/<pkg>/src/index.ts` with esbuild (bundle, minify, esm, browser, `packages: "external"`) and gzips the result; no dependency on `pnpm build`
- [x] Budgets in `tooling/budgets.json` unchanged (6kb runtime-dom, 4kb reactive, 8kb router) and met
- [x] `docs/OUTPUT.md` budgets paragraph names the measurement

## Steps
1. [x] Measured: tsc `dist/index.js` gzips to 84-127 bytes (pure re-exports), so the old check could never breach. Own-code bundle: runtime-dom 3,435 B, reactive 1,970 B, router 7,029 B. With dependencies inlined: 7,872 / 1,970 / 13,262 B.
2. [x] Implement; run `node tooling/budgets.mjs`; prove a breach fires by lowering one budget in a scratch copy (not committed).

## Decisions
- D1: Dependencies are external (`packages: "external"`). A budget is per package; each kernel dependency carries its own budget, and the same bytes are not charged twice. Router inlining schema and reactive would be 13.3kb against an 8kb budget that was set per package.
- D2: Entry is `src/index.ts`, not dist, so the budget runs in `pnpm check` without a build step and sees the same source the package `exports` field ships.

## Verification
- [x] `node tooling/budgets.mjs` trailer `ok budgets N measured` with 3 size entries measured
- [x] Lowering `@keel/reactive` to `1kb` in a scratch copy yields `B0002 ... exceeds budget`
- [x] `pnpm check` green

## Next action
None; closed.
