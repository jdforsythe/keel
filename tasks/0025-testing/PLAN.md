# Task 0025: testing (also covers 0026)

**Spec:** k.testing · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/testing

## Deliverables
- [x] `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), find(id), dispose() }` (0025)
- [x] events by id only (E1701, E1705 with nearest ids); sim ctx; a11y tree from the live DOM; minimal axe rules (E1703) (0025)
- [x] `properties(component | transaction, { runs, seed? })` with E1704 failure output and `KEEL_SEED` replay (0026)
- [x] pure `ledger(items)` and `ledgerDiff(before, after)` (E1706) (0026)
- [x] property tests (a11y names over generated labels; ledger rung monotonicity); README; changeset
- [x] E1702 via `render(C, { artifacts })` (D22); `renderRoute` (D23)
- [ ] axe-core: minimal rules only (D9)

## Steps
1. [x] conformance-writer wrote packages/testing/conformance from k.testing (commit c72e0ff).
2. [x] Implement; `tsc --noEmit` and biome clean (src, test, unsafe).
3. [x] Verify behavior against a scratch copy of the conformance suite with the store block of fixtures.ts wrapped in `scope` (D1); deleted afterwards.
4. [x] Package tests in test/ (seed 1337); smoke test removed; README; changeset.
5. [x] Fixture fix committed under rfc:0000 (eb7256d); WIP committed (ea3e73e).
6. [x] Review round 1 applied (D15-D19), then RFC 0007 items (D20-D21).
7. [x] Review round 2 committed (0d81407); E1702 and `renderRoute` added (D22-D23).
8. [ ] Re-review; spec status -> implemented.

## Decisions
- D1: conformance/fixtures.ts calls `store(...)` at module top level; since rfc:0003 `store` requires a scope (E1203), so the fixture throws at import and every conformance file importing it (19 of 21) fails to load. Not changed (read-only). Fix for an rfc:NNNN PR: create the three stores inside `scope(() => ...)` (a never-disposed module scope). With that one change the suite is 66 passed, 2 skipped (E1701 static lint, E1702).
- D2: `TestComponent<P>` = `(props: P, slots?, ctx?) => Node` with `readonly Props: Schema<P>`, defined here (runtime-dom's `Component` has no `Props`).
- D3 (D18 supersedes the dispose clause): `render` mounts `() => Component(parsedProps, undefined, ctx)` with runtime-dom `mount(..., container, { ctx })` inside a `scope`; the container is appended to `document.body` and removed on `dispose`. Store state is not rolled back on dispose (tests state their inputs; one way).
- D4: `state` entries are applied with `store.restore({ state: v, log: [], initial: v })`, the only public schema-checked write (`Store` exposes no schema). On the first invalid value, earlier entries are put back and `schema.invalid` is thrown before mounting.
- D5 (settling superseded by D15): runtime-dom has no public dispatch; `fire` dispatches a real DOM event on the element found by id, so the root's delegated table (or the element listener for focus/blur) handles it. `input` sets `value` first. Settling: macrotask turns (`setTimeout 0`) until the container HTML and every store's state are unchanged across a turn, max 100 turns (then a plain Error; no E-code exists for it). Under fake timers `fire` would hang.
- D6 (superseded by D20): `mount` now adds a root Boundary rendering `<pre data-k-error="<at>">` (documented in runtime-dom). `render` and `fire` turn such a catch into an Error `keel.unexpected at <at>: <message>`, so render throws still fail tests and `properties`.
- D7 (names refined by D19): a11y tree: only id-bearing elements are nodes; elements without an id are transparent (descendants lifted); `hidden`/`aria-hidden` subtrees are omitted. `a11y()` returns the top-level node array; `a11y(id)` the node (equal to its tree entry). Name order: aria-labelledby, aria-label, `<label for>`/wrapping label (form controls), alt, button-like `value`, content text (non-controls, all roles: matches the spec example `find('cart.total').name`), title. Names are trimmed but not whitespace-collapsed so generated labels round-trip. State keys appear only when applicable (`disabled`/`invalid`/`focused` only when true).
- D8: E1701 is raised only after an exact id miss, for strings with a leading `.`, any of `# [ ] > ~ * ,` or whitespace, or a bare HTML tag name (`div`). Other misses are E1705 with the 3 nearest ids (Levenshtein).
- D9: E1703 rules: image-alt, button-name, link-name, label; checked after render and after every `fire`; up to 5 listed.
- D10 (state generation superseded by D21): `properties(transaction)` generates payloads only (no store schema is reachable, so no generated state); each case runs from the live state: commit with every invariant holding, `undo` restores the input, a second `tx` gives the same output; stores whose log changed are restored. Invariants are anonymous, so the message names the transaction: `E1704 bad.addAny: invariant failed (seed 1337, run 4, shrunk)` + `  payload: {...}`. No `path:line:col` (no source location at runtime).
- D11: `properties(component)` generates `Props` only and checks: render without throw (incl. E1703 and root-Boundary catches) and two renders with one seed give equal a11y tree and `state()`. `a11y.json` (E1702) is skipped: no API names or supplies it.
- D12: generators come from `gen(schema)` on `@keel/schema/gen` (rfc:0006, applied in the working tree during this task); `Schema.gen()` is gone.
- D13: `ledger`: failing evidence is ignored; a property counts as `probabilistic` only with `seed` and >= 100 runs, otherwise `example`; `evidence` is the passing entries or `"none"`; records carry `kind: 'ledger'`. Rank: none < monitored < example < probabilistic < exhaustive < proven. `ledgerDiff` ignores new and removed items and unknown rung names; entries are `{ kind: 'diag', code: 'E1706', item, before, after, message, see }`.
- D14: harness errors are `Error`s with `code`, `data`, `see: 'k.testing'`; the message starts with the code.
- D15 (review 1): `fire` settles without timers: it attaches a MutationObserver to the mount container, dispatches, then runs rounds of 16 `await Promise.resolve()` hops; done after 2 consecutive rounds with no DOM mutation and no change in any store's log length; more than 50 rounds throws `keel.unexpected` "fire did not settle". 16 hops per round (not 1): a single hop let the conformance fixture's 3-step `.then` chain (about 7 hops) finish after 2 "quiet" rounds, so fire-settles failed. `tick.ts` removed.
- D16 (review 1): `tooling/ledger.mjs` is an I/O shell over `ledger`/`ledgerDiff`, imported by relative path (Node strips types). Evidence per referencing test file (static scan; assumed passing): no fast-check -> `example`; fast-check -> `property` with runs = largest literal `numRuns:`/`runs:` (fast-check default 100 when none) and seed = first literal `seed: n` / `SEED = n` / `Seed: n` header. Flags, ledger.json shape, and trailer kept; overload signatures are no longer listed more than once (`properties` had 3 entries). Lowered rungs report E1706 (was L0001); the unsafe-count check stays L0001.
- D17 (review 1): consequence of D16: under the spec rule (seeded, >= 100 runs) 7 items the old scan called `probabilistic` are `example` (cli lsp/mcp/run, router createRouter/loader/manifest, ui styles: their property tests run < 100 times or state no seed). ledger.json is regenerated; `--diff` against the regenerated file is clean, but against HEAD it reports those 7 E1706 until the new ledger.json is committed. The L0001 `unsafe count up 3 -> 4` is unrelated (HEAD's committed ledger is stale; the old script reports it too).
- D18 (review 1): `render` snapshots every seeded store before seeding; `dispose` (and a failed render) restores them, newest first.
- D19 (review 1): names per accname: every `<label for>` (document order) then an enclosing label both contribute, joined by a space; `aria-labelledby` targets contribute their aria-label, else img alt, else content, never following their own aria-labelledby (a self-reference uses the element's own label or content); name from content only for WAI-ARIA "name from contents" roles (button, link, heading, cell, option, ...). A `<p>` has name "" (use `find().text`); the spec example `find('cart.total').name` holds only if that element has such a role.
- D20 (RFC 0007): root-Boundary catches come from `mount(..., { ctx, onError })`; `render` and `fire` throw the first as `keel.unexpected at <at>: <message>` (data kept). The DOM scrape (`rootError.ts`) is removed.
- D21 (RFC 0007): `properties(transaction)` generates `(state, payload)` pairs with `gen(t.store.schema)` and `gen(t.schema)`, one pair per run (`runs` pairs; fast-check shrinks both). Stores do not expose invariants, so a generated state counts only if it holds them: `holds(store, state)` commits an identity transaction `keel.testing.holds` (defined once per store via the public `transaction()`) from that state and reads `store.invariant`; failing states are skipped with `fc.pre`; too many skips is E1704 "too few generated states satisfy the invariants". Each case restores the store's prior snapshot. Failure output: `payload:` then `state:` lines. Side effect: each probed store gains the transaction name `keel.testing.holds` (never left in its log). A cleaner path is an RFC exposing an invariant check on `Store`. Components still generate `Props` only (the stores a component reads are not known).

- D24 (RFC 0011): D21's `holds` probe is gone (`src/internal/holds.ts` deleted): `properties(transaction)` filters generated states with `fc.pre(store.check(state).ok)`. Stores no longer gain a `keel.testing.holds` transaction. Behaviour and failure output otherwise as D21.
- D22: E1702: `render`/`renderRoute` take `artifacts` (typed `Pick<Artifacts, "a11y.json">` from `@keel/compiler`, a type-only import). After the first render and after every `fire` (before E1703), every visible rendered element whose id is in `a11y.json` must have the expected role (skipped when the entry's role is `null`) and the expected name source. The rendered source is where the non-empty name came from: `aria` (aria-labelledby/aria-label), `label`, `alt`, `text` (name from content); button-like `value`, `title`, or an empty name are `none`, as the compiler models it. Ids missing on either side are skipped; up to 5 mismatches listed. Known divergences that will raise E1702 until the compiler and harness agree: compiler `img` for `alt=""` (harness `presentation`), compiler `region` for every `<section>` (harness `generic` when unnamed), compiler name-from-content list includes `listitem` and lacks `gridcell`, `menuitemcheckbox`, `menuitemradio`, `sectionhead`.
- D23: `renderRoute(id, { routes, params?, search?, state?, ctx?, artifacts? })`: seeds state, creates `createRouter(routes, { ctx, history })` on an in-memory history (src/internal/memoryHistory.ts, the router tests' pattern without pop) starting at `href(id, params, search)`, so the router's initial navigation runs guards and loaders; mounts `router.App` through the shared harness (src/internal/openHarness.ts, also used by `render`), then settles until no navigation is pending and the DOM is quiet and runs the checks. Returns the `render` handle plus `route()` (`router.route.get()`); `fire` also waits while a navigation or action is pending; `dispose` disposes the router and restores seeded stores. Not started from `/` then navigated, so loaders run exactly once.

## Verification
- [x] `tsc --noEmit` clean (includes conformance) · biome clean on src/test/unsafe · unsafe count 0
- [x] conformance green (fixture fix eb7256d): 66 passed, 2 skipped (E1701 static lint, E1702)
- [x] `pnpm --filter @keel/testing check` clean; structure-lint clean
- [x] properties present: test/a11y-names.property.test.ts, test/ledger.property.test.ts, test/transaction.property.test.ts, test/harness.test.ts (seed 1337)
- [x] `node tooling/ledger.mjs --diff` clean (regenerated ledger committed in 0d81407; `renderRoute` entry added)
- Mutation: `mutate` is `echo skip`; 70% threshold not measured.

Test trailer (`pnpm --filter @keel/testing test`): `ok 99 tests, 0 failed, 2 skipped (1.9s)`

## Next action
review
