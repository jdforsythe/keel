# k.model: Exploring a store's transactions
status: conformance-covered

`explore` visits every state a store reaches from a start state through a set of its transactions and checks the store's invariants (k.store) in each. Where `properties` (k.testing) samples generated states, `explore` enumerates the reachable ones, so a passing run is evidence for every state it visited (k.ledger `exhaustive`, `proven`).

**API** (`@keel/testing`).
```ts
const r = explore([addList, addTodo, toggleTodo], { from: fixture, payloads: { 'api.addTodo': [milk, bread] }, depth: 3 })
explore(Object.values(editorChart.events))   // closed form
```
`explore(transactions, { from?, payloads?, depth?, maxStates = 10000 })`, synchronous:
- `transactions`: one or more transactions of one store, distinct by name; else it throws E1710.
- Start: `from`, parsed by the store's schema and `check`ed (fail: E1710); else the store's current state.
- Domains: a transaction's payloads are `payloads[name]` (each parsed by its schema, fail: E1710), else every value of its payload schema when that schema is finite: literals, enums, booleans, integers with `min` and `max`, and objects, unions and optionals of finite parts, at most 256 values. A transaction with neither is E1710 before any edge runs.
- Edges: from each state, each transaction in the given order with each payload in domain order (enum and union members as declared, `false` before `true`, integers ascending, object values by key order, an absent optional first). An edge runs as a `properties` case runs a transaction: the store is restored to the state, `tx` commits, the output is read, and the store's snapshot from before `explore` is restored at the end, log `meta` included.
- Order: breadth first, so each state is reached by a shortest path. Two states are one when their JSON encodings by the store schema, keys sorted, are equal. A path stops after `depth` edges.

**Result** (JSON): `{ states, edges, depth, complete, terminal }`. `states`: every distinct state visited, the start first, in visiting order. `edges`: how many ran. `depth`: the longest shortest path. `complete`: true when no state was left unexpanded. `terminal`: the visited states from which every edge returned the same state or `err`.

**Counterexample.** An edge whose `tx` returns `store.invariant`, or whose function throws, stops the run with E1708: message `explore <store>: <transaction> broke an invariant after <n> steps (<k> states)`. The thrown error's `data` is `{ snapshot, transaction, payload }`: `snapshot` a k.store snapshot whose `initial` is the start state and whose `log` is the shortest path to the state the edge ran on, so `restore(snapshot)` and then `tx` of `transaction` with `payload` reproduce it. An edge that `tx` refuses before the transaction's function runs (`store.undeclared`, `schema.invalid`, `keel.conflict`) is E1710, naming the transaction and the code.

**Closed form.** With none of `from`, `payloads` and `depth`, `transactions` must name every transaction of its store (`store.payloads`), the store's log must be empty, and the run must end `complete`; else E1709 or E1710. A passing closed run shows that every invariant holds in every state the store reaches from its start under every payload its schemas allow.

**Bounds.** Reaching `maxStates` (at most 1,000,000) distinct states while an unexpanded state within `depth` remains is E1709 with the counts: such a run enumerated no finite space and claims nothing.

**Rules.** E1708 an invariant broke, or a transaction threw, on an explored edge · E1709 `maxStates` reached before the space or `depth` was exhausted, or a closed form that did not close · E1710 transactions of several stores or repeated names, a `from` or `payloads` value that fails its schema, a transaction with no finite domain (message names it: give `payloads`), or a closed form missing a transaction or starting from a store with log entries.

**Conformance.**
- From `from`, with payload lists, `explore` visits exactly the states reachable within `depth` edges, each once and the start first, and `edges` counts one per expanded state, transaction and payload.
- Two calls with equal arguments return equal results.
- A transaction that breaks a declared invariant from a reachable state fails with E1708 whose `data.snapshot` log has the fewest entries of any path to it, and `restore` of that snapshot followed by `tx` of `data.transaction` with `data.payload` returns `store.invariant`.
- A three-member enum, a boolean and an integer with `min` 0 and `max` 2 payload field give 3 × 2 × 3 payloads in the declared order; an `s.string()` field with no `payloads` entry is E1710 and runs no edge.
- A closed form over a store whose space closes returns `complete: true`; one missing a transaction of the store, or whose space exceeds `maxStates`, fails with E1710 or E1709.
- After `explore` returns or throws, the store's state, log and log `meta` equal those before the call.
- `terminal` holds a state from which every transaction returns that state unchanged, and no state with an edge to another.
