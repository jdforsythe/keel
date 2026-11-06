# Task 0012: runtime-dom

**Spec:** k.runtime (+ k.errors Boundaries, k.compiler URL rule) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/runtime-dom

## Deliverables
- [x] `.`: `mount`, intrinsics `If`, `For`, `Match`, `Case`, `Boundary` (runtime value = op wrapper, for hand-built trees)
- [x] `./ops`: `template`, `clone`, `text`, `attr`, `prop`, `on`, `cond`, `list`, `match`, `boundary`, `resume`
- [x] delegated events, Boundary, resume with E1253 fallback, pre-resume event queue, URL scheme rule
- [x] property tests (seed 1337); README contract; changeset; spec status -> implemented (k.runtime.md, 00-map.md)

## Steps
1. [x] conformance-writer suite present (packages/runtime-dom/conformance, incl. boundary.test.ts added mid-task).
2. [x] Implement; check; test.
3. [x] Properties; README; changeset; spec status.

## Decisions
- D1: `resume` is exported from `./ops` only, not `.`: conformance imports it from `@keel/runtime-dom/ops`, and k.runtime says app code uses only `mount` + intrinsics (generated entry is the caller). Brief listed it under `.`; one way (P1) wins.
- D2: Op signatures (k.runtime names them only): `template(html): HTMLTemplateElement` (exactly one root element) · `clone(t): Element` · `text(node, fn)` · `attr(el, name, fn)` · `prop(el, name, fn)` · `on(id, type, handler)` · `cond(anchor, when, then, otherwise?)` · `list(anchor, each, key: item => unknown, render: (item(), index()) => Node)` · `match(anchor, on, key, cases: Record<tag, (value()) => Node>)` · `boundary(anchor, children, fallback(error, reset))`. Structural ops take any `Node` anchor and insert content immediately before it (boundary.test uses element anchors).
- D3: `on(id)` resolves `id` (element `id` or `data-k`) among elements cloned in the current render unit, newest first; the handler table is keyed by element (WeakMap), so repeated rows with the same source id get their own handlers.
- D4: k.reactive disposes an effect's children on every rerun and has no owner re-entry or untracked read. Consequences: (a) each branch/row/boundary child renders inside its own effect ("unit") so its reads do not subscribe the structural op; a top-level read in a render body re-renders that unit (compiled code must read inside bindings); (b) keyed rows are owned by a "nursery": a chain of one-shot effects in the list's stable scope (src/internal/createNursery.ts), costing one idle effect node per commit that adds rows. Follow-up RFC: `runIn(scope, fn)` or an untracked render would remove both.
- D5: Runtime keeps a parallel `Owner` tree (cleanups for direct listeners and handler entries, delegation root, nearest Boundary). RFC 0003 `Scope.onDispose` could replace the cleanup half once landed.
- D6: Boundary state is a signal; every effect that may report to a Boundary declares it in `writes` (E1201-safe). `fail` disposes the child unit synchronously (no effect of the failed subtree runs again), then sets state; `reset` sets it back. `data.at`: handler -> `on` id; binding -> bound element id; render -> anchor's nearest id.
- D7: Not caught by Boundary: throws from app-level `effect()` / `computed` read outside our bindings, because they surface from k.reactive's flush with no owner attribution. Needs a k.reactive error-owner hook (RFC). No conformance covers it.
- D8: Resume protocol: first `clone` in an island claims the island root; structural ops claim the server region `<!--[-->…<!--]-->` immediately before their anchor and render into it (closing marker becomes the insertion point). Shape check compares element tags/structure only (text and comments are dynamic). Any mismatch (also a missing component, bad #k-state, unknown store) -> warning `E1253 [data-k-island="id"] …`; structural mismatch re-renders that island client-side in place. Non-mismatch throws during resume are rethrown after all islands are attempted. Compiler/server must emit these markers; nested child components outside a region are not claimable yet (fallback: E1253 + client render).
- D9: Store restore uses an internal structural type `Restorable { restore(snapshot) }` passed as `resume(root, components, stores?)`; TODO: switch to k.store's `stores()` registry (rfc:0003) when @keel/store lands.
- D10: Island props are decoded with the component's static `Props` schema (`decode`) when present, else passed as JSON.
- D11: Pre-resume queue: capture listeners on `document` for 19 bubbling interaction types, installed at import of `src/ops/resume.ts` (README documents it as the one import-time effect); events are keyed to their outermost unresumed island and replayed through its delegation root; events queued for an island that falls back to client render are dropped.
- D12: `safeUrl(name, value)` lives in `src/internal/safeUrl.ts` and is exported as `@keel/runtime-dom/internal/safeUrl` for the compiler's server renderer; strips leading C0/space and ignores tab/CR/LF before scheme detection. Applied by `attr` and `prop`.
- D13: test/setup.ts (vitest `setupFiles`): vitest's happy-dom env leaves Node's native `EventTarget` global while nodes extend happy-dom's; the setup aligns the global so `EventTarget.prototype` patches (conformance `trackListeners`) see DOM listeners. Environment fix only; no test edited.
- D14: `mount` has no default Boundary; the generated entry wraps App in one (k.errors "app root has a default one").

## Conformance issues (not changed; need rfc)
- E1203 conflict: attr-toggle.test.ts (3 tests), mount-dispose.test.ts "zero reactive subscriptions", boundary.test.ts "after a catch, no effect…" (2 tests) create `signal()` at test level; k.reactive conformance (rules.conformance.test.ts) requires that to throw E1203. Verified all six pass when the signal is created in a live root scope (temporary copies, deleted).
- boundary.test.ts lines 39/45: `node()` is annotated `: Node` and then `.querySelector` is called -> TS2339, so `pnpm --filter @keel/runtime-dom check` fails in tsc. Fix: annotate `: Element` (clone returns Element).

## Verification
- [ ] conformance green: 19 pass, 6 fail (E1203 conflict above), 9 todo
- [x] properties present (test/: attr, delegation, mount-dispose, safeUrl, structural, resume): 21 pass
- [x] biome clean (src, test, unsafe) · structure-lint clean for runtime-dom · build config compiles
- [ ] `check`: tsc fails only on conformance/boundary.test.ts (TS2339 above)
- compiler conformance (drives these ops via compiled code): `ok 29 tests, 0 failed, 1 skipped`
- Mutation: `mutate` is `echo skip`; 70% threshold not measured.

Test trailer (`pnpm --filter @keel/runtime-dom test`): `fail 55 tests, 9 failed, 9 skipped (0.7s)` (reporter also counts 3 file-level errors from the same E1203 failures; verbose: 40 pass, 6 fail, 9 todo).

## Next action
review
