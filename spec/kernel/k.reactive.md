# k.reactive: Reactivity
status: conformance-covered

**API.** `signal(initial)`, `computed(fn, { equals? })`, `effect(fn, { writes: [] })`, `resource(fetcher)` returning `{ state: 'loading' } | { state: 'error', error } | { state: 'ready', value }`. All created inside an ownership scope (component or `scope(fn)`) and disposed with it. `scope(fn, { onError? })` runs `fn` in a new scope; `onError(error)` receives throws from effects and computeds owned by it. `owner()` returns the running scope handle `Scope { dispose, parent, onDispose, run }` or undefined. `scope.run(fn)` runs `fn` with that scope as owner, untracked (writes are still checked), and returns its value. `inspect()` returns the live graph `{ nodes: { id, kind }[], edges: { from, to }[] }`.

**Rules.** Reads inside `computed` and `effect` register dependencies; writes outside declared `writes` are E1201; cycles in the dependency graph are E1202; reactive primitives created outside a scope are E1203; `resource` consumed without `Match` is E1204; reading a disposed `computed` is E1205; `run` on a disposed scope is E1206.

**Artifacts.** Compiler emits `deps.json`: nodes (signals, computeds, effects, elements) and edges.

**Conformance.** Glitch-free propagation; disposal frees all subscriptions; effects run after commit; resource state transitions are exactly loading -> ready | error; stale resource results never overwrite newer ones; `owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect; an effect that throws inside a scope with onError delivers the error to that scope's onError and no outer scope's; the throwing effect does not run again; sibling effects still run; without onError the error rethrows from batch; nodes created inside `scope.run(fn)` are disposed with that scope; `run` on a disposed scope throws E1206; reads inside `run` do not register dependencies of an enclosing effect.
