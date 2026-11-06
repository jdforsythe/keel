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
- D8: a disposed computed's `get` calls `fn` directly (no cache, no subscription of its own). Signals are not registered with owners (nothing to free; their observers unsubscribe themselves).
- D9: public interface types live in `src/types/` because `Signal.ts`/`signal.ts` collide on case-insensitive filesystems.
- D10: error shape: `Error & { code, see: 'k.reactive' }`, message prefixed with the code (no shared KeelError type exists yet).
- D11: failure recovery: a throwing effect is left Clean (re-runs on its next change) and the rest of the commit's queue is kept for the next commit; a throwing computed stays Dirty so the next read retries.

## Verification
- [x] conformance green (31) · properties present (test/*.property.test.ts, seed 1337) · `pnpm --filter @keel/reactive check` clean · size budget 4kb gz (bundled 1894 B gz, minified 1427 B; dist/index.js alone 121 B)
- Package test trailer: `ok 57 tests, 0 failed, 0 skipped (0.4s)`
- Mutation: `mutate` script is `echo skip` (Stryker not wired). Manual mutants (19) on engine branches all killed by test/ after adding examples/internal tests.
- Root: `pnpm check` -> turbo check, structure-lint, docs-freshness, budgets ok; `generate --check` fails on turbo.json reformatted outside this task. `pnpm test` fails only in packages/schema (concurrent task).

## Next action
review
