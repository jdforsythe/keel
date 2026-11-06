# @keel/testing

**Spec:** k.testing · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `render(Component, { props, state?: [store, value][], ctx? }) -> { a11y(id?), state(store?), fire(id, event), find(id), dispose() }` · `properties(component | transaction, { runs = 100, seed? }) -> Promise<{ seed, runs }>` · `ledger([{ item, evidence }])` · `ledgerDiff(before, after)`. A component is `(props, slots?, ctx?) => Node` with a static `Props`.
- **Invariants:** props and state values parse first (`schema.invalid`, nothing renders). Sim ctx seeded by `KEEL_SEED` (default 1337) unless `ctx` is given. Ids only: selector-shaped strings are E1701, absent ids E1705 with the 3 nearest. `find`/`a11y` never return nodes. `fire` dispatches a real DOM event and resolves once DOM and stores stop changing. Root-Boundary catches fail with `keel.unexpected`; img-alt, button-name, link-name, label violations are E1703. Property failures throw E1704 with seed, run, and shrunk case. Rungs: passing test `example`; seeded property >= 100 runs `probabilistic`; `exhaustive`/`proven` only from their own evidence. `ledgerDiff` reports strictly lowered items (E1706).
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/store`, `@keel/runtime-dom`, `@keel/ctx`, `fast-check`.
- **Rungs:** conformance; properties (a11y names, ledger monotonicity), seed 1337.

## Extension points

None. Not yet: `a11y.json` (E1702), `renderRoute`, axe-core.

## Unsafe

count: 0
