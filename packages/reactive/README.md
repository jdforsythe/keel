# @keel/reactive

**Spec:** k.reactive · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `scope(fn) -> Scope { dispose }` · `signal(v) -> Signal<T> { get, set }` · `computed(fn, { equals? }) -> Computed<T> { get }` · `effect(fn, { writes? }) -> Effect { dispose }` · `batch(fn) -> T` · `resource(fetcher) -> Resource<T> { get(): ResourceState<T>, refetch }` · `inspect() -> { nodes: { id, kind }[], edges: { from, to }[] }`.
- **Invariants:** Glitch-free push-pull: a computed recomputes at most once per commit, lazily, only if a source changed; a result `equals` the last (default `Object.is`) keeps the old value and stops propagation. Store `select` returning structures should pass `equals`. A commit is one changing `set` or the outermost `batch`; effects run once after it (and on creation); a throwing effect does not stop the others; the first error is rethrown (`fn`'s own first, in `batch`). Disposing a scope disposes and unsubscribes everything in it, nested and mid-run included. `resource`: `loading -> ready | error` only; fetcher reruns on `refetch()` or a change of a signal it read; latest request id wins; a reader throwing on `ready` fails it via `loading`.
- **Errors** (`Error` with `code`, `see`): `E1201` write in a computed, or in an effect to a signal/resource (`refetch`) not in `writes` · `E1202` self-read, self-invalidation, or effects unsettled after 1000 passes · `E1203` primitive outside a scope · `E1205` read of a disposed computed.
- **Dependencies:** none at runtime.
- **Rungs:** conformance; properties (DAG vs model, run counts, equals, inspect edges, scope trees, resource orders).

## Extension points

None. One way per concept; no `untrack`, no aliases.

## Unsafe

count: 0
