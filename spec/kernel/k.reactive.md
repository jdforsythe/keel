# k.reactive: Reactivity
status: proposed

**API.** `signal(initial)`, `computed(fn)`, `effect(fn, { writes: [] })`, `resource(fetcher)` returning `{ state: 'loading' } | { state: 'error', error } | { state: 'ready', value }`. All created inside an ownership scope (component or `scope(fn)`) and disposed with it.

**Rules.** Reads inside `computed` and `effect` register dependencies; writes outside declared `writes` are E1201; cycles in the dependency graph are E1202; reactive primitives created outside a scope are E1203; `resource` consumed without `Match` is E1204.

**Artifacts.** Compiler emits `deps.json`: nodes (signals, computeds, effects, elements) and edges.

**Conformance.** Glitch-free propagation; disposal frees all subscriptions; effects run after commit; resource state transitions are exactly loading -> ready | error; stale resource results never overwrite newer ones.
