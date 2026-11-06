# Task 0005-0006: reactive

**Spec:** k.reactive · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/reactive
Covers backlog 0005 (signal, computed, effect, scopes) and 0006 (resource union, declared writes, cycle detection).

## Deliverables
- [x] `signal`, `computed`, `effect(fn, { writes })`, `resource(fetcher)`, `scope(fn)` with disposal (+ `batch`)
- [x] glitch-free propagation; effects run after commit (batch); disposal frees subscriptions
- [x] resource state union loading|error|ready; stale results never overwrite newer
- [x] runtime E1201 (undeclared write) and E1202 (cycle) as thrown Error with `code`; E1203 outside scope
- [x] property tests; README; changeset

## Steps
1. [x] conformance-writer writes packages/reactive/conformance from k.reactive.
2. [x] Implement (hand-written push-pull engine, see D2).
3. [x] Properties; README; changeset; spec status -> implemented.

## Decisions
- D1: resource fetcher receives an AbortSignal-free context; staleness tracked by monotonically increasing request id.
- D2: engine is hand-written (~420 lines incl. comments, src/internal/), Reactively/Solid-style push-pull mark-and-sweep: a write marks direct observers Dirty and transitive ones Check; queued effects pull, verifying Check sources in read order and recomputing only if one actually changed (Object.is cutoff). No runtime dependency (ADR-0010 permits borrowing the algorithm, not a package; budget 4 kB gz).
- D3: a commit is one changing `set` outside a batch, or the outermost `batch`. Effects (including their first run) are queued and run at commit; effects created during a flush or batch run in the same commit.
- D4: cycle detection E1202 has three triggers: a computed read while it is running; a node marked while it is running (covers effect reading then writing the same signal, directly or via computeds); effects not settling within 1000 flush passes (effect ping-pong). The first two are graph cycles regardless of convergence.
- D5: E1201 applies to any write while a computation is running: computeds have an empty `writes`; effects use their declared list (`readonly Signal<unknown>[]`, method bivariance lets `Signal<number>` in).
- D6: computeds and effects are owners: primitives created in their run are disposed before the next run. `scope` does not untrack; it only changes the owner. If `scope`'s fn throws, the scope is disposed and the error rethrown.
- D7: `resource` runs its fetcher inside an internal effect, so signals read synchronously by the fetcher trigger a refetch (the reactive-input path; no separate `source` argument). `refetch()` while already loading does not notify. Results of a disposed resource are dropped.
- D8: (superseded by D13) ~~a disposed computed's `get` calls `fn` directly~~. Signals are now registered with owners too (D15 registry), but disposing one only removes it from `inspect`; it keeps working as a value.
- D9: public interface types live in `src/types/` because `Signal.ts`/`signal.ts` collide on case-insensitive filesystems.
- D10: error shape: `Error & { code, see: 'k.reactive' }`, message prefixed with the code (no shared KeelError type exists yet).
- D11: failure recovery: a throwing effect is left Clean (re-runs on its next change); a throwing computed stays Dirty so the next read retries. (Queue handling superseded by D16.)
- D12 (review 1): a computation disposed while running neither subscribes afterwards (`track` skips a gone reaction) nor keeps children created afterwards (`refresh` disposes owned + unlinks after `fn` returns). Same for a scope disposed from inside its own `fn`.
- D13 (review 2): reading a disposed computed throws E1205 "read of a disposed computed" (one way; no silent staleness). Added to the k.reactive Rules line.
- D14 (review 3): `computed(fn, { equals? })`, default `Object.is`. An equal result keeps the previous value (identity stable) and does not propagate. Store `select` returning structures should pass `equals` (README).
- D15 (review 4): nodes carry `kind` (signal|computed|effect|resource|scope) and a numeric `id` (module-wide counter, creation order). `rt.nodes` is a live registry (removed on dispose). `inspect()` returns `{ nodes: {id, kind}[], edges: {from, to}[] }` with an edge per dependency (`from` read by `to`), only between live nodes. A resource is ONE node: its fetcher-run node is also the source its readers subscribe to (no internal signal), so deps.json sees fetcher deps -> resource -> readers. Consequence: effect-like nodes (effect, resource) are never pulled by a read and do not propagate Check; a resource notifies its readers itself when it changes state.
- D16 (review 5): errors are neither masked nor lost. `flush` runs every queued effect even if some throw, then rethrows the first (the 1000-pass E1202 guard is also collected). `batch`: if `fn` throws, the commit still runs and `fn`'s error is rethrown (commit errors dropped). Resource promise callbacks never reject: a reader throwing while observing `ready` makes the resource fail as `ready -> loading -> error(thatError)` (keeps transitions legal); errors thrown by readers during that recovery, or while observing `error`, have no caller and are dropped. `refetch()` is a write: inside a computed, or an effect without the resource in `writes`, it is E1201 (`writes` accepts `Signal | Resource`).
- D17 (rfc:0003): `owner()` returns the nearest enclosing scope node's public handle (the same object `scope(fn)` returns; stored on the node as `handle`), also inside computeds and effects. `Scope` gains `parent` (owner() at creation) and `onDispose(fn)` (hooks run at the end of `dispose`, once; immediately if already disposed). Needed by store `uses`, ancestors walk and registry.

## Verification
- [x] conformance green (31) · properties present (test/*.property.test.ts, seed 1337) · `pnpm --filter @keel/reactive check` clean · size budget 4kb gz (after D12-D16: bundled 2307 B gz, minified 1717 B; dist/index.js alone 128 B)
- Package test trailer: `ok 73 tests, 0 failed, 0 skipped (0.5s)`
- Mutation: `mutate` script is `echo skip` (Stryker not wired). Manual mutants (19) on engine branches all killed by test/ after adding examples/internal tests. Review round: 17 more on the D12-D16 guards; all killed except two behaviour-equivalent ones (mark not propagating Check from effect-like nodes; refresh skipping effect sources: both only save queue work).
- Root: `pnpm check` -> turbo check, structure-lint, docs-freshness, budgets ok; `generate --check` fails on turbo.json reformatted outside this task. `pnpm test` fails only in packages/schema (concurrent task).

## Next action
re-review (review 1 fixes D12-D16 applied, uncommitted)
