# k.reactive: Reactivity
status: conformance-covered

**API.** `signal(initial)`, `computed(fn, { equals? })`, `effect(fn, { writes: [] })`, `resource(fetcher)` returning `{ state: 'loading' } | { state: 'error', error } | { state: 'ready', value }`; a fetcher's throw or rejection is `error`, and a resolved keel `Result` (made by k.schema `ok`/`err`) unwraps: `ok(v)` is `ready` with `v`, `err(e)` is `error` with `e`; any other value is `ready` as is. A fetcher typed `Promise<Result<T, E>>` gives `Resource<T>`. All created inside an ownership scope (component or `scope(fn)`) and disposed with it. `scope(fn, { onError?, detached? })` runs `fn` in a new scope; `onError(error)` receives throws from effects and computeds owned by it. A `detached` scope is a root: it has no `parent`, runs `fn` untracked, takes no outer `onError` (without its own, an effect's throw rethrows from the commit that ran it), and only its own `dispose()` disposes it. Having no `parent`, it escapes its creator's `uses` declarations and request store registry (k.store), so only kernel and stdlib code create one (E1207). `owner()` returns the running scope handle `Scope { dispose, parent, onDispose, run }` or undefined. `scope.run(fn)` runs `fn` with that scope as owner, untracked (writes are still checked), and returns its value. `inspect()` returns the live graph `{ nodes: { id, kind }[], edges: { from, to }[] }`. A computed's throw surfaces in the computation reading it: the computed runs once per commit and keeps the error, each reader's `get()` throws it until a source changes, and its first value after a throw counts as a change. Disposing a scope, effect or computed disposes every node it owns, then runs its `onDispose` hooks in registration order; a throwing hook stops none of this, and `dispose()` rethrows the first error (an owned node's before the node's own hooks') and drops the rest. `scope(fn)` and `scope.run(fn)` rethrow `fn`'s own error in place of a hook's.

**Rules.** Reads inside `computed` and `effect` register dependencies; writes outside declared `writes` are E1201; cycles in the dependency graph are E1202; reactive primitives created outside a scope are E1203; `resource` consumed without `Match` is E1204; reading a `computed` whose scope is disposed is E1205; `run` on a disposed scope is E1206; `scope` given `detached: true` or a non-literal options object in app code is E1207, but in a lifted range of a library's `unsafe/` (k.check App code).

**Artifacts.** Compiler emits `deps.json`: nodes (signals, computeds, effects, elements) and edges.

**Conformance.**
- Glitch-free propagation.
- Disposal frees all subscriptions.
- Effects run after commit.
- Resource state transitions are exactly loading -> ready | error.
- Stale resource results never overwrite newer ones.
- `owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect.
- An effect that throws inside a scope with onError delivers the error to that scope's onError and no outer scope's; the throwing effect does not run again; sibling effects still run; without onError the error rethrows from batch.
- Nodes created inside `scope.run(fn)` are disposed with that scope.
- Reading a computed after its scope is disposed throws E1205, also from a live effect that reads it.
- `run` on a disposed scope throws E1206.
- A `detached` scope created inside another scope has no `parent`, survives that scope's disposal with its effects still running, and its effect's throw reaches no outer `onError`; its `dispose()` disposes it.
- Reads inside a `detached` scope's `fn` do not register dependencies of an enclosing effect.
- E1207 fires on `scope(fn, { detached: true })` and on `scope(fn, opts)` in app code, not on `scope(fn, { onError })` or in a kernel or stdlib package.
- Reads inside `run` do not register dependencies of an enclosing effect.
- A fetcher resolving a keel Result `err(e)` settles `error` with `e`, one resolving `ok(v)` settles `ready` with `v`, one resolving a plain object shaped like a Result settles `ready` with that object, and one that throws or rejects settles `error` with the thrown value.
- A fetcher typed `Promise<Result<T, E>>` gives `Resource<T>`, and one typed `Promise<{ ok: boolean; value?: T }>` compiles and gives a `Resource` of that type.
- An effect reading a computed that throws after a later write gets that throw from its own `get()`, where a `try` around the read catches it; no `onError` receives it.
- A computed that threw and then returns its value from before the throw reruns its readers (also with `equals`, through a computed chain, and for a `resource` fetcher reading it).
- A throwing computed runs at most once per commit however many readers and dependent computeds read it, and every reader's `get()` throws that one error.
- A throwing `onDispose` hook stops no disposal: every owned node is disposed and every later hook runs, `dispose()` rethrows the first error in disposal order (owned nodes before the node's own hooks, hooks in registration order), and `scope(fn)` rethrows `fn`'s error over a hook's.
