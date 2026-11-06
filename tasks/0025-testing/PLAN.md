# Task 0025: testing (also covers 0026)

**Spec:** k.testing · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/testing

## Deliverables
- [x] `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), find(id), dispose() }` (0025)
- [x] events by id only (E1701, E1705 with nearest ids); sim ctx; a11y tree from the live DOM; minimal axe rules (E1703) (0025)
- [x] `properties(component | transaction, { runs, seed? })` with E1704 failure output and `KEEL_SEED` replay (0026)
- [x] pure `ledger(items)` and `ledgerDiff(before, after)` (E1706) (0026)
- [x] property tests (a11y names over generated labels; ledger rung monotonicity); README; changeset
- [ ] E1702 (`a11y.json` comparison), `renderRoute`, axe-core: not implemented (see D11)

## Steps
1. [x] conformance-writer wrote packages/testing/conformance from k.testing (commit c72e0ff).
2. [x] Implement; `tsc --noEmit` and biome clean (src, test, unsafe).
3. [x] Verify behavior against a scratch copy of the conformance suite with the store block of fixtures.ts wrapped in `scope` (D1); deleted afterwards.
4. [x] Package tests in test/ (seed 1337); smoke test removed; README; changeset.
5. [ ] Review; rfc:NNNN for the fixture fix (D1); spec status -> implemented after review.

## Decisions
- D1: conformance/fixtures.ts calls `store(...)` at module top level; since rfc:0003 `store` requires a scope (E1203), so the fixture throws at import and every conformance file importing it (19 of 21) fails to load. Not changed (read-only). Fix for an rfc:NNNN PR: create the three stores inside `scope(() => ...)` (a never-disposed module scope). With that one change the suite is 66 passed, 2 skipped (E1701 static lint, E1702).
- D2: `TestComponent<P>` = `(props: P, slots?, ctx?) => Node` with `readonly Props: Schema<P>`, defined here (runtime-dom's `Component` has no `Props`).
- D3: `render` mounts `() => Component(parsedProps, undefined, ctx)` with runtime-dom `mount(..., container, { ctx })` inside a `scope`; the container is appended to `document.body` and removed on `dispose`. Store state is not rolled back on dispose (tests state their inputs; one way).
- D4: `state` entries are applied with `store.restore({ state: v, log: [], initial: v })`, the only public schema-checked write (`Store` exposes no schema). On the first invalid value, earlier entries are put back and `schema.invalid` is thrown before mounting.
- D5: runtime-dom has no public dispatch; `fire` dispatches a real DOM event on the element found by id, so the root's delegated table (or the element listener for focus/blur) handles it. `input` sets `value` first. Settling: macrotask turns (`setTimeout 0`) until the container HTML and every store's state are unchanged across a turn, max 100 turns (then a plain Error; no E-code exists for it). Under fake timers `fire` would hang.
- D6: `mount` now adds a root Boundary rendering `<pre data-k-error="<at>">` (documented in runtime-dom). `render` and `fire` turn such a catch into an Error `keel.unexpected at <at>: <message>`, so render throws still fail tests and `properties`.
- D7: a11y tree: only id-bearing elements are nodes; elements without an id are transparent (descendants lifted); `hidden`/`aria-hidden` subtrees are omitted. `a11y()` returns the top-level node array; `a11y(id)` the node (equal to its tree entry). Name order: aria-labelledby, aria-label, `<label for>`/wrapping label (form controls), alt, button-like `value`, content text (non-controls, all roles: matches the spec example `find('cart.total').name`), title. Names are trimmed but not whitespace-collapsed so generated labels round-trip. State keys appear only when applicable (`disabled`/`invalid`/`focused` only when true).
- D8: E1701 is raised only after an exact id miss, for strings with a leading `.`, any of `# [ ] > ~ * ,` or whitespace, or a bare HTML tag name (`div`). Other misses are E1705 with the 3 nearest ids (Levenshtein).
- D9: E1703 rules: image-alt, button-name, link-name, label; checked after render and after every `fire`; up to 5 listed.
- D10: `properties(transaction)` generates payloads only (no store schema is reachable, so no generated state); each case runs from the live state: commit with every invariant holding, `undo` restores the input, a second `tx` gives the same output; stores whose log changed are restored. Invariants are anonymous, so the message names the transaction: `E1704 bad.addAny: invariant failed (seed 1337, run 4, shrunk)` + `  payload: {...}`. No `path:line:col` (no source location at runtime).
- D11: `properties(component)` generates `Props` only and checks: render without throw (incl. E1703 and root-Boundary catches) and two renders with one seed give equal a11y tree and `state()`. `a11y.json` (E1702) is skipped: no API names or supplies it.
- D12: generators come from `gen(schema)` on `@keel/schema/gen` (rfc:0006, applied in the working tree during this task); `Schema.gen()` is gone.
- D13: `ledger`: failing evidence is ignored; a property counts as `probabilistic` only with `seed` and >= 100 runs, otherwise `example`; `evidence` is the passing entries or `"none"`; records carry `kind: 'ledger'`. Rank: none < monitored < example < probabilistic < exhaustive < proven. `ledgerDiff` ignores new and removed items and unknown rung names; entries are `{ kind: 'diag', code: 'E1706', item, before, after, message, see }`.
- D14: harness errors are `Error`s with `code`, `data`, `see: 'k.testing'`; the message starts with the code.

## Verification
- [x] `tsc --noEmit` clean (includes conformance) · biome clean on src/test/unsafe · unsafe count 0
- [ ] conformance: red as committed (D1: fixture import throws E1203); 66 passed / 2 skipped against the scope-wrapped fixture copy
- [ ] `pnpm --filter @keel/testing test` currently cannot load `@keel/ctx`: commit 878b495 deleted packages/ctx/unsafe/unsafe.ts while ctx/unsafe/narrowAccessor.ts still imports it (another task's change). With a scratch resolver mapping it to the emitted unsafe.js: package tests 16 passed; conformance copy as above.
- [x] properties present: test/a11y-names.property.test.ts, test/ledger.property.test.ts (seed 1337)
- Mutation: `mutate` is `echo skip`; 70% threshold not measured.

Test trailer (`pnpm --filter @keel/testing test`, as committed): `fail 1 tests, 24 failed, 1 skipped (0.9s)` (all load failures: ctx import, then D1). Scratch run: `82 passed, 2 skipped`.

## Next action
review
