# Task 0009: ctx

**Spec:** k.ctx · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/ctx

## Deliverables
- [x] `ctx.clock.now()`, `ctx.random.uuid()/float()`, `ctx.net.fetch(req)`, `ctx.storage.get/set`
- [x] `real`, `shell`, `sim` implementations for each; sim deterministic by seed
- [x] `register(name, { real, shell, sim })` registry (extension point); `createCtx({ mode, seed })` (see D2)
- [x] property tests (sim determinism); README; changeset

## Steps
1. [x] conformance-writer writes packages/ctx/conformance from k.ctx (commit 38d37bf).
2. [x] Implement; check; test.
3. [x] Properties; README; changeset; spec status -> implemented.

## Decisions
- D1: `shell` implementations default to delegating to `real` until Capacitor/Tauri adapters exist (S8); must be distinct objects so conformance "all three implementations" holds. Done by building fresh capability objects per ctx.
- D2: Registry is a module-level `register(name, impls)` without the spec's `iface` arg, matching conformance. Spec text `ctx.register(name, iface, …)` diverges; needs an RFC to align the spec.
- D3: `register` returns a typed accessor `(ctx) => T` so strict TS reads registered capabilities without casts; (superseded by D10).
- D4: `createCtx` overload: `{ mode: 'sim' }` returns `SimCtx` (clock.advance, net.route); otherwise `Ctx`. Seed defaults to 0, coerced to uint32.
- D5: Sim PRNG is xoshiro128** seeded by splitmix32 (in-house). uuid = 4 draws with v4/variant bits forced; float = draw / 2^32. First four outputs for seed 1337 are pinned in a test for replay compatibility.
- D6: Sim net is an in-memory route table: exact URL or prefix ending `*`, first match wins, else 404 `sim net: no route for <METHOD> <url>`.
- D7: Storage interface is named `KeyValueStorage` (avoids shadowing DOM `Storage`) and is async (fits Capacitor Preferences). Real storage resolves `localStorage` per call and throws where absent.
- D8: Sim clock `advance` throws RangeError on negative or non-finite ms to keep monotonicity.
- D9: `packages/ctx/tsconfig.build.json` adds `rewriteRelativeImportExtensions: true`; the factory config failed TS5097 on `.ts` import paths. Every package with internal imports hits this; factory follow-up.
- D10 (rfc:0001): accessor only; `ctx[name]` is no longer attached (Principle 1). Type restoration on idempotent re-register uses one justified `unsafe` in `unsafe/narrowAccessor.ts` (unsafe count +1).
- D11 (rfc:0001): `register` is idempotent for the same name and identical impls object (reference equality); a different object throws E1602.
- D13 (rfc:0012): `Clock.after(ms, signal?)`. Sim: waiters keyed by (deadline, registration seq); `advance` steps `now()` to each due deadline, resolving in order, then to the target. Abort rejects with `signal.reason` and drops the waiter. Real: `setTimeout` clamped to 2^31-1, cleared on abort. Shell delegates to real.
- D12 (rfc:0001): each registered capability's seed = ctx seed xor FNV-1a(name), so streams do not correlate.

## Verification
- [x] conformance green · properties present · `pnpm --filter @keel/ctx check` clean · structure-lint clean for ctx
- Root `pnpm check`/`pnpm test` red only in packages/schema and packages/reactive (conformance without implementation; other tasks).
- Mutation: `mutate` script for ctx is `echo skip`; 70% threshold not measured.

Test trailer (`pnpm --filter @keel/ctx test`): `ok 39 tests, 0 failed, 0 skipped (0.7s)`

## Next action
review
