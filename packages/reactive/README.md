# @keel/reactive

**Spec:** k.reactive · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `scope(fn, { onError?, detached? }) -> Scope { dispose, parent, onDispose(fn), run(fn) -> T }` · `owner() -> Scope | undefined` · `signal(v) -> Signal<T> { get, set }` · `computed(fn, { equals? }) -> Computed<T> { get }` · `effect(fn, { writes? }) -> Effect { dispose }` · `batch(fn) -> T` · `resource(fetcher) -> Resource<Settled<T>> { get(): ResourceState<Settled<T>>, refetch }` · `inspect() -> { nodes: { id, kind }[], edges: { from, to }[] }`. `@keel/reactive/internal` (kernel only, RFC 0070): `pulse()` for registries and `lastResource` for `Match` resource ids.
- **Invariants:** Glitch-free push-pull: a computed recomputes at most once per commit, lazily, only if a source changed; a result `equals` the last (default `Object.is`) keeps the old value and stops propagation. Store `select` returning structures should pass `equals`. A commit is one changing `set` or the outermost `batch`; effects run once after it (and on creation); a throwing effect does not stop the others; the first error is rethrown (`fn`'s own first, in `batch`), unless the effect's nearest ancestor scope declares `onError`: then that handler receives it after the commit, the effect is marked failed (never reruns) and nothing is rethrown (a throw inside `onError` propagates). Disposing a scope disposes and unsubscribes everything in it, nested and mid-run included. A `detached` scope is a root: `parent` undefined, no owner disposes it or lends it an `onError`, `fn` runs untracked (writes still checked); only its own `dispose()` ends it (a recorder that outlives the component that started it). `scope.run(fn)` creates under that scope from anywhere (e.g. inside an effect, outliving its reruns); reads inside it subscribe nothing; writes are still checked against the running computation's `writes`; a throw propagates and leaves the scope live. `resource`: `loading -> ready | error` only; fetcher reruns on `refetch()` or a change of a signal it read; latest request id wins; a throw or rejection is `error`, and a keel `Result` (branded by k.schema `ok`/`err`) unwraps (`ok(v)` is `ready` with `v`, `err(e)` is `error` with `e`; a plain `{ ok, error }` object stays `ready`; `Resource<Settled<T>>`; rfc:0068); a reader throwing on `ready` fails it via `loading`.
- **Errors** (`Error` with `code`, `see`): `E1201` write in a computed, or in an effect to a signal/resource (`refetch`) not in `writes` · `E1202` self-read, self-invalidation, or effects unsettled after 1000 passes · `E1203` primitive outside a scope · `E1205` read of a disposed computed · `E1206` `run` on a disposed scope.
- **Dependencies:** none at runtime.
- **Rungs:** conformance; properties (DAG vs model, run counts, equals, inspect edges, scope trees, `run`-attached trees and untracked reads, resource orders).

## Extension points

None. One way per concept; no `untrack` (an untracked read is `scope.run`, which also names the owner), no aliases.

## Unsafe

count: 0
