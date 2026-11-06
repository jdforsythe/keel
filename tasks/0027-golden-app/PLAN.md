# Task 0027: golden app 1 (client-only)

**Spec:** all kernel sections (slice: `evals/tasks/golden-1/spec-slice.txt`) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** apps/golden-1

## Deliverables
- [x] Eval task `evals/tasks/golden-1/` (`TASK.md`, `spec-slice.txt`, `pass.ts`); `pnpm exec tsc --noEmit -p evals/tsconfig.json` clean
- [ ] `apps/golden-1/`: todo app per `evals/tasks/golden-1/TASK.md`, built by an agent from spec + skill
- [ ] Property tests for all four transactions, `TodoRow`, `Suggestions`; example tests for every other export
- [ ] Eval baseline in `evals/results/` for >= 2 models (docs/TESTING.md "Evals")

## Steps
0. [ ] Prereqs: 0001-0026 and 0040 merged; open questions Q1-Q4 answered by RFC (or TASK.md/spec-slice amended). Until then the eval agent reports `blocked:`.
1. [ ] Scaffold: `keel scaffold project golden-1` under `apps/`, then `keel codemod rename app todos` and `keel scaffold route|component|store|transaction` per the TASK file list, once scaffold (0023/0024) lands; else by hand.
2. [ ] Build: schemas, `board` store and invariant, transactions, guard, loaders and actions, routes, components, `tokens.ts`.
3. [ ] Properties: `properties()` for transactions and `TodoRow`, `Suggestions`; examples per TASK.md; `pnpm eval --task golden-1 --runner none` prints `converged=true`.
4. [ ] Eval baseline: from a tree without `apps/golden-1/`, `pnpm eval --task golden-1 --model <id>` for two models; commit `evals/results/<date>-golden-1-<model>.json`; record trailers below.

## Decisions
- D1: Domain is the PRD's golden app 1 (todo lists, filter in URL search, protected route with a stub guard), not orders/cart; it carries every brief requirement (list, detail with params, Form create/edit with schema validation, store with 4 transactions and an invariant, resource + `Match` from sim net, light/dark tokens, base elements, ids, a11y props, undo via log). Deferred to 0032 (real API): optimistic adds and the settings form; the stub guard reads `ctx.storage` `todos.readOnly` so no login route is needed.
- D2: One module, `todos`. The scaffold's default `app` module is renamed by codemod, not hand-edited.
- D3: Transactions stay pure; ids are minted in actions with `ctx.random.uuid()` and passed in payloads. Each transaction is total over generated payloads (unknown or duplicate id: state unchanged) so `properties()` can hold the invariant.
- D4: `tooling/ledger.mjs` scans only `packages/*/src` function exports, so `pass.ts` checks the app's ledger itself: every export under `modules/` (except `module.ts`, `routes.ts`, `Props`) is named in a test file; `ledger.mjs --diff` still guards kernel regressions. Follow-up backlog item: extend the ledger to `apps/*` and to every `<file>#<name>` export (k.testing).
- D5: Output budgets in `pass.ts` reuse `tooling/budgets.json` `check.injected10` (600) and `test.failing3` (400) against quiet stdout, chars/4. No app-specific budget yet.
- D6: Tests live in `apps/golden-1/test/`; package name `golden-1` so `turbo --filter golden-1` matches.
- D7: The baseline uses `run.ts`'s default skill, `keel-package-dev` (a kernel-package skill; the user skill `keel` is 0033), so G1 numbers are "spec + kernel skill". `run.ts` does not record the skill in results. Follow-up: add `skill` to the result JSON and rerun with `keel` at 0033.

## Open questions (spec gaps; RFC before step 4)
- Q1: How does a component reach `ctx`? `resource(fetcher)` takes `() => Promise<T>`; principle 2 bans context providers; k.testing `render(..., { ctx })` implies a path. Blocks `Suggestions`.
- Q2: E1651 (k.services) bans `ctx.net.fetch` in app code, but services land at G2 (0029). Either E1651 is not enforced before 0029 or `Suggestions` waits for a service.
- Q3: How a client-only deployable is declared: `topology` adapters are `node|static`, and `static` forbids param routes (E1553); 0040 adds the topology input. Also who generates the `mount` entry and root `App` for a router app.
- Q4: Syntax for a component's `uses: [tx]` declaration (k.store, k.component), and whether actions may call `tx` in a client-only deployable (k.server).

## Verification
- [x] `pnpm exec tsc --noEmit -p evals/tsconfig.json` clean; `pass.ts` returns false with no app present
- [ ] `pnpm eval --task golden-1 --runner none` -> `converged=true`
- [ ] Baseline results committed for two models; `unsafe=0`

## Next action
Step 0: file RFCs for Q1-Q4 and the D4/D7 follow-ups in `tasks/BACKLOG.md`.
