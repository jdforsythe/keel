# Task 0009: ctx

**Spec:** k.ctx · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/ctx

## Deliverables
- [ ] `ctx.clock.now()`, `ctx.random.uuid()/float()`, `ctx.net.fetch(req)`, `ctx.storage.get/set`
- [ ] `real`, `shell`, `sim` implementations for each; sim deterministic by seed
- [ ] `ctx.register(name, iface, { real, shell, sim })` registry (extension point); `createCtx({ mode, seed })`
- [ ] property tests (sim determinism); README; changeset

## Steps
1. conformance-writer writes packages/ctx/conformance from k.ctx.
2. Implement; check; test.
3. Properties; README; changeset; spec status -> implemented.

## Decisions
- D1: `shell` implementations default to delegating to `real` until Capacitor/Tauri adapters exist (S8); must be distinct objects so conformance "all three implementations" holds.

## Verification
- [ ] conformance green · properties present · `pnpm check` clean

## Next action
Step 1.
