# Task 0027: golden app 1 (client-only)

**Spec:** all kernel sections (slice: `evals/tasks/golden-1/spec-slice.txt`) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** apps/golden-1

## Deliverables
- [x] Eval task `evals/tasks/golden-1/` (`TASK.md`, `spec-slice.txt`, `pass.ts`); `pnpm exec tsc --noEmit -p evals/tsconfig.json` clean
- [x] `apps/golden-1/`: todo app per `evals/tasks/golden-1/TASK.md`, built by an agent from spec + skill (2026-11-06; partial behavior, see D12-D14)
- [x] Property tests for all four transactions, `TodoRow`, `Suggestions`; example tests for every other export
- [ ] Eval baseline in `evals/results/` for >= 2 models (docs/TESTING.md "Evals")

## Steps
0. [ ] Prereqs: 0001-0026 and 0040 merged (Q1-Q4 resolved in spec: D8-D11).
1. [x] Scaffold (2026-11-06, `@keel/scaffold` in-process: project, module todos, 3 routes, 4 components, store, rename schema; then hand-moved to the TASK file list, D15): `keel scaffold project golden-1` under `apps/`, then `keel codemod rename app todos` and `keel scaffold route|component|store|transaction` per the TASK file list, once scaffold (0023/0024) lands; else by hand.
2. [x] Build: schemas, `board` store and invariant, transactions, guard, loaders and actions, routes, components, `tokens.ts`.
3. [x] Properties: `properties()` for transactions and `TodoRow`, `Suggestions`; examples per TASK.md; `pnpm eval --task golden-1 --runner none` prints `converged=true`.
4. [ ] Eval baseline: from a tree without `apps/golden-1/`, `pnpm eval --task golden-1 --model <id>` for two models; commit `evals/results/<date>-golden-1-<model>.json`; record trailers below.

## Decisions
- D1: Domain is the PRD's golden app 1 (todo lists, filter in URL search, protected route with a stub guard), not orders/cart; it carries every brief requirement (list, detail with params, Form create/edit with schema validation, store with 4 transactions and an invariant, resource + `Match` from sim net, light/dark tokens, base elements, ids, a11y props, undo via log). Deferred to 0032 (real API): optimistic adds and the settings form; the stub guard reads `ctx.storage` `todos.readOnly` so no login route is needed.
- D2: One module, `todos`. The scaffold's default `app` module is renamed by codemod, not hand-edited.
- D3: Transactions stay pure; ids are minted in actions with `ctx.random.uuid()` and passed in payloads. Each transaction is total over generated payloads (unknown or duplicate id: state unchanged) so `properties()` can hold the invariant.
- D4: `tooling/ledger.mjs` scans only `packages/*/src` function exports, so `pass.ts` checks the app's ledger itself: every export under `modules/` (except `module.ts`, `routes.ts`, `Props`, `uses`) is named in a test file; `ledger.mjs --diff` still guards kernel regressions. Follow-up: backlog 0042 (ledger scans `apps/*/modules` exports).
- D5: Output budgets in `pass.ts` reuse `tooling/budgets.json` `check.injected10` (600) and `test.failing3` (400) against quiet stdout, chars/4. No app-specific budget yet.
- D6: Tests live in `apps/golden-1/test/`; package name `golden-1` so `turbo --filter golden-1` matches.
- D7: The baseline uses `run.ts`'s default skill, `keel-package-dev` (a kernel-package skill; the user skill `keel` is 0033), so G1 numbers are "spec + kernel skill". `run.ts` does not record the skill in results. Follow-up: add `skill` to the result JSON and rerun with `keel` at 0033.
- D8 (was Q1): Components take `ctx` as a third parameter `(props, slots?, ctx?)`, passed by the runtime from the mount or island root and by the harness `render(..., { ctx })`; resource fetchers close over it (k.component). `Suggestions` uses this.
- D9 (was Q2): E1651 is not enforced until k.services is implemented; golden app 1 calls `ctx.net.fetch` directly through the component's ctx (stated in TASK.md and the slice). Migrates to a service at 0032.
- D10 (was Q3): k.server topology adapter `client`: no server, loaders and actions run in the browser, the compiler generates the entry calling `mount(App, el)`. `topology.ts` uses `adapter: 'client'`.
- D11 (was Q4): `export const uses = [toggleTodo, ...]` beside `Props` in the component file; the compiler calls `uses(...)` in the component scope (k.component). Loaders and actions are exempt from E1301, so actions call `tx` directly. `uses` is ledger-exempt in `pass.ts` like `Props`.

- D12 (blocked): `@keel/ui` `Button`/`Checkbox` expose no event-handler prop and intrinsics are E1805, so the Undo click and the TodoRow toggle cannot be wired. Undo renders with its reactive `disabled` (log empty); the undo example calls `board.undo()`. `TodoRow` declares `uses = [toggleTodo]` but never calls `tx`. Needs a k.ui spec line (e.g. `onPress`/`onChange` on base elements, lowered to `on(id, ...)`).
- D13 (blocked): the router calls route/layout components without `ctx` (`renderView` passes props only), so `Suggestions` inside `todos.list` sees `ctx === undefined` and renders its error state; Suggestions loading/ready/error is tested via `render(Suggestions, { ctx })`.
- D14 (workarounds, no casts): (a) components set `Name.Props = Props` (TS expando) because `render`/`properties` need a static `Props` the compiler does not attach; (b) router `Form` and runtime `Match`/`Case` are called as functions and inserted through a local `children()` binding (compiler D31), because `Form` spreads the RFC 0008 children thunk (crash) and `<Case>` is not a valid JSX element under `@keel/runtime-dom/jsx-runtime`; `Match` gets an explicit `key: "state"` or its wrapper reads `on` in the component scope and re-renders forever; (c) layout `children` is a Node from the router, inserted the same way; (d) branded ids are minted by `transaction.schema.parse` in actions; (e) tests locate generated form-field ids (`form<n>:title`) by accessible name in `a11y()`.
- D15: wiring follows the orchestrator brief, not TASK.md lines 1-2: scripts `tsc --noEmit && biome check modules` / `vitest run` / `vite build`, tsconfig extends `@keel/compiler/tsconfig.strict.json` plus `jsxImportSource: @keel/runtime-dom`; added `index.html`, `vitest.config.ts` (happy-dom, KeelReporter, `keel()`). Scaffold's `modules/app`, app `turbo.json`, `.github/`, colocated tests, `<route>.server.ts` names and `board.store.ts`/`BoardState.schema.ts` were not kept (TASK file list wins).
- D16: `keel check` (CLI, not in the app's check script) still reports E1752 on `TodoRow.tsx` (`uses` beside the default export, which k.component allows) and 10 x E1004 for `routes.ts` importing `*.server.ts` (the CLI does not pass `topology.ts`, whose `client` adapter exempts them). Both are checker issues, not app issues.
- D17 (rfc:0009; resolves D12): `Button onClick` and `Checkbox onChange` exist. AppShell's Undo calls `board.undo()`; TodoRow's checkbox calls `tx(toggleTodo, { id })`. `routes.test.ts` fires the row checkbox (`change`) and Undo (`click`) and asserts `done` flips then the prior state returns. D12's workaround comments are gone.
- D18: workarounds removed after router D26/D27 and forms D19b: AppShell reads `props.children?.()`; ListPage passes a children thunk to `Form`, takes `ctx` so `Suggestions` shows sim suggestions (routes.test.ts).
- D19: removed the hand `Name.Props = Props` assignments (compiler D35 attaches them; `TestComponent.Props` now optional) and `Suggestions` is back to JSX `<Match on={list.get()}><Case<State> tag="loading">...` with no explicit key (compiler D36 passes `state`; runtime D25-D26). Vite plugin no longer checks `test/**` (compiler D37).
- D20: `AppShell` renders layout children as `{props.children?.()}` (compiler D38 inserts `children?.()` with or without `?? fallback` as a node; before, the `?? ""` form lowered as a text binding and `todos.main` was empty). Root `biome.json` turns `correctness.useJsxKeyInIterable` off: Keel keys `For` rows with the `key` prop, not React keys, so the rule's three hits in `ListPage.tsx` were false positives.

## Verification
- [x] `pnpm exec tsc --noEmit -p evals/tsconfig.json` clean; `pass.ts` returns false with no app present
- [x] `pnpm eval --task golden-1 --runner none` -> `converged=true` (2026-11-06; `evals/results/2026-11-06-golden-1-none.json`; `unsafe=4` is the repo-wide count, app has 0)
- [ ] Baseline results committed for two models; `unsafe=0`

## Browser verification (2026-11-06)
Headless Chromium via tooling/smoke/{smoke,interact,todo-flow}.mjs: renders; add list via Form action; link navigation is client-side (store persists); add todo; toggle via Checkbox onChange; Undo via Button onClick restores; no page errors.

## Next action
File backlog items for D12, D13, D14(a-c,e), D16 and the scaffold gaps (D15); then step 4 (two-model baseline) from a tree without `apps/golden-1/`. Still open: D7 follow-up.
