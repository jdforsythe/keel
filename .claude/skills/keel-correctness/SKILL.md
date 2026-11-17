---
name: keel-correctness
description: "Keel correctness tools and ledger rungs: properties, explore, simulate, std-statecharts chart, proven/exhaustive/probabilistic/monitored; E1704, E1706, E1708-E1710"
---

# Properties, exploration, simulation, charts

Spec: `pnpm spec k.testing`, `k.model`, `k.sim`, `k.ledger`, `std.statecharts`.

**Properties:** `await properties(Comp | transaction, { runs: 100, seed })`. Components: no throw, a11y matches, no axe violations, deterministic. Transactions: output parses, every `invariant(store, fn)` holds, `undo` restores. Replay with `KEEL_SEED=<n>`; a failure is E1704 (seed, run, shrunk case). Every export is named in a test: the ledger credits an item when a passing test's body, or a helper it calls in its own file or a relative import, names it.

**Reachable states and faults:** `explore([tx1, tx2], { from, payloads, depth })` visits every state a store reaches and checks its invariants (E1708 with a replayable snapshot; E1709 `maxStates` reached; E1710 a transaction with no finite domain: give `payloads`); with no options and every transaction named it is the closed form, `proven`. `await simulate(async ({ ctx, run }) => { ... await run() ... }, { runs: 100, seed })` runs a scenario under generated schedules of delays, drops, 503s and offline windows.

**Rungs:** `proven` needs a closed `explore` or type-level tests, `exhaustive` an `explore` run, `probabilistic` 100-run `properties` or `simulate`, `monitored` a `.keel/monitored.json` from `keel session monitor`. A lowered rung is E1706.

**Charts:** a flow with states (editing, saving, retrying) is `chart('todos.editor', { data, start, events, initial, states })` from `@keel/std-statecharts` in a client-safe file; it compiles to a store and a transaction per event, so `explore(Object.values(chart.events))` is its closed form.
