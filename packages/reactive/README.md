# @keel/reactive

**Spec:** k.reactive · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `scope(fn) -> Scope { dispose }` · `signal(v) -> Signal<T> { get, set }` · `computed(fn) -> Computed<T> { get }` · `effect(fn, { writes? }) -> Effect { dispose }` · `batch(fn) -> T` · `resource(fetcher) -> Resource<T> { get(): ResourceState<T>, refetch }`.
- **Invariants:** reads in `computed`/`effect` register dependencies. Glitch-free push-pull: a computed recomputes at most once per commit, lazily, only if a source changed; `Object.is`-equal results stop propagation. A commit is one changing `set` or the outermost `batch`; effects run once after it (and on creation). Disposing a scope disposes and unsubscribes everything created in it, nested scopes included; idempotent; a throwing `scope` fn disposes its scope; an effect's children are disposed before each rerun. `resource` goes `loading -> ready | error` only; fetcher runs on creation, `refetch()`, and change of a signal it read synchronously; only the latest request id settles.
- **Errors** (`Error` with `code`, `see`): `E1201` write in a computed, or in an effect to a signal not in `writes` · `E1202` computed reads itself, computation invalidates itself, or effects unsettled after 1000 passes · `E1203` primitive outside any scope.
- **Dependencies:** none at runtime.
- **Rungs:** conformance; properties (DAG vs model, run counts, scope trees, resource orders).

## Extension points

None. One way per concept; no `untrack`, no aliases.

## Unsafe

count: 0
