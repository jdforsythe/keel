# k.reactive: Reactivity
status: implemented

**API.** `signal(initial)`, `computed(fn, { equals? })`, `effect(fn, { writes: [] })`, `resource(fetcher)` returning `{ state: 'loading' } | { state: 'error', error } | { state: 'ready', value }`. All created inside an ownership scope (component or `scope(fn)`) and disposed with it. `owner()` returns the running scope handle `Scope { dispose, parent, onDispose }` or undefined. `inspect()` returns the live graph `{ nodes: { id, kind }[], edges: { from, to }[] }`.

**Rules.** Reads inside `computed` and `effect` register dependencies; writes outside declared `writes` are E1201; cycles in the dependency graph are E1202; reactive primitives created outside a scope are E1203; `resource` consumed without `Match` is E1204; reading a disposed `computed` is E1205.

**Artifacts.** Compiler emits `deps.json`: nodes (signals, computeds, effects, elements) and edges.

**Conformance.** Glitch-free propagation; disposal frees all subscriptions; effects run after commit; resource state transitions are exactly loading -> ready | error; stale resource results never overwrite newer ones; `owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect.
