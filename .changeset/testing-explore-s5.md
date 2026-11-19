---
"@keel/testing": minor
---

`explore(transactions, { from, payloads, depth, maxStates })` (k.model) enumerates every state a store reaches through its transactions, breadth first, checking invariants on every edge, and returns `{ states, edges, depth, complete, terminal }`. Payload domains come from `payloads` or from finite payload schemas. A broken invariant or a throw is E1708 with the shortest path as a replayable snapshot; `maxStates` reached is E1709; bad arguments are E1710. Called with none of `from`, `payloads` and `depth`, it is the closed form over the store's whole space.
