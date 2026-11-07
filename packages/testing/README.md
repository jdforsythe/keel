# @keel/testing

**Spec:** k.testing · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `render(Component, { props, state?: [store, value][], ctx?, artifacts? }) -> { a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }` · `renderRoute(id, { routes, params?, search?, ... }) -> Promise<same + route()>` · `properties(component | transaction, { runs = 100, seed? }) -> Promise<{ seed, runs }>` · `ledger([{ item, evidence }])` · `ledgerDiff(before, after)`. A component is `(props, slots?, ctx?) => Node` with a static `Props`. · `testResults(files, errors, cwd) -> TestReport` (vitest's finished task tree as T0001 diagnostics at the first app frame, compact diff as `fix`, plus counts; shared by `keel test` and tooling's KeelReporter).
- **Invariants:** props and state values parse first (`schema.invalid`, nothing renders); `dispose` restores seeded stores. Sim ctx (`KEEL_SEED`, default 1337) unless `ctx` is given. Ids only: selector-shaped strings are E1701, absent ids E1705 with the 3 nearest. `find`/`a11y` never return nodes. `settle()` runs the same loop with no event (after a resource resolves); `fire` dispatches a real DOM event; resolves after two quiet microtask rounds (no timers), else `keel.unexpected`. Root-Boundary catches (`onError`) fail with `keel.unexpected`; `a11y.json` mismatch (with `artifacts`) is E1702; axe-like violations E1703. Property failures throw E1704 with seed, run, shrunk case. Rungs: passing test `example`; seeded property >= 100 runs `probabilistic`; `exhaustive`/`proven` only from their own evidence. `ledgerDiff` reports lowered items (E1706); `keel ledger` uses both.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/store`, `@keel/runtime-dom`, `@keel/router`, `@keel/compiler` (types), `@keel/ctx`, `fast-check`.
- **Rungs:** conformance; properties (a11y names, ledger monotonicity), seed 1337.

## Extension points

None. Not yet: axe-core (minimal rules only).

## Unsafe

count: 0
