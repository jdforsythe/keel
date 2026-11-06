# Task 0014-0015: router

**Spec:** k.router (+ k.server loader/action semantics, k.forms seam, k.errors route boundaries) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/router

## Deliverables
- [x] 0014: `manifest` (validation E1502-E1506), `href` (branded `Href`), matching (static beats `:param`, trailing slash), params 404, search key dropping
- [x] 0015: `loader`, `action`, `guard`, `createRouter` (`navigate`, `route`, `App`, `dispose`), `Form`, revalidation, pending, push focus and scroll, back scroll restore
- [x] `routesArtifact(manifest)` for the compiler's `routes.json`; `browserHistory()`
- [x] property tests (seed 1337); smoke test removed; README contract; changeset; spec status and map row -> implemented

## Steps
1. [x] Implement; `pnpm --filter @keel/router check` clean.
2. [x] Conformance: 29/30 green (E1501 case: see Verification).
3. [x] Properties: href/navigate round-trip over generated manifests, static beats param regardless of order, trailing slash canonicalized. Examples: manifest codes, `routesArtifact`, revalidation recovering from an error view.
4. [x] README, `.changeset/router-initial.md`, k.router `status: implemented`, map row.

## Decisions
- D1: API per conformance fixtures: `createRouter(manifest, { ctx, history })` -> `{ navigate, route, App, dispose }`; `route` is a `Computed` read with `.get()`. `RouterHistory = { push, replace, current, onPop }`; `onPop` may return an unsubscribe. `browserHistory()` added so a real entry can build one (sets `scrollRestoration = "manual"`).
- D2: `manifest()` registers routes in a process-wide table; `href(id)` and `Form` read it (fixtures call `href` and `Form` with only an id). Re-declaring an id replaces it (HMR, per-test manifests in forms conformance); cross-module duplicate ids are left to `keel check`. Same for `guard(name)`: a process-wide table, last declaration wins, resolved by name at navigation time.
- D3: Manifest validation throws `Error` with `code`: E1502 duplicate pattern (vs every registered route), E1503 path/params mismatch or malformed path, E1504 required search field, E1505 non-verb actions key, E1506 layout with a path or local cycle. Unknown layout names and cross-manifest cycles are E1506 at `createRouter` (layouts may live in another module's manifest; avoids import-order dependence). Unknown guard name at navigation renders `keel.unexpected` (E1506 in message).
- D4: `href` is typed by `Href` brand only; the id parameter is `string` (no registry type). Typed ids need codegen or a `Register` interface: follow-up. `href` throws for an unknown id or a layout id (code E1501), and for search on a route without a search schema (E1504). Absent optionals are stripped before `encode` (the schema rejects explicit `undefined`).
- D5: URL parsing is manual (no `new URL`), so dot segments are not normalized; segments are `decodeURIComponent`ed (malformed escapes: 404). Rank: candidates with equal segment count, lexicographic static(0)/param(1) string, lowest wins.
- D6: Search parsing: undeclared keys dropped; `decodeStrings`, then drop the top-level keys named in issues and retry until ok. Known edge: an optional string search value `""` reads back as absent (schema `fromStrings`).
- D7: Params failure (404) renders the nearest `errorElement` of the matched chain alone (bare), without layouts: their loaders must not run, so their `data` would be missing. No match at all, or no errorElement in the chain: the root default (`role="alert"`, `data-keel-error`). `route.get().id` is `null` for 404s. Guard failures other than `keel.denied` also render bare.
- D8: Loaders do not use `resource`: a resource drops its value while `loading`, which conflicts with "previous page stays rendered" and "revalidation changes neither scroll nor focus". Each committed view owns one `signal` per chain level (in its own root scope, disposed when replaced); components get `data` as a getter over that signal, so `ok(null)` revalidation updates data without re-rendering unless a component reads `data` during render.
- D9: Navigation commits synchronously when the chain has no guards and no loaders (forms conformance mounts and reads the page synchronously after `createRouter`). Otherwise `pending` goes true, guards run in order, loaders start together in chain order, and the latest navigation token wins. History is pushed at commit (the URL matches what is rendered); a denied push pushes the redirect target; initial/pop redirects replace.
- D10: Rendering uses runtime-dom ops: `App` is a fragment with an anchor and a root `boundary` (fallback: default alert; its `reset` is called on the next commit). Each chain level with an `errorElement` is its own `boundary` whose fallback is that errorElement (k.errors "every route is a boundary"). A loader `err` renders the nearest errorElement at or above the outermost failing level, with layouts above it.
- D11: `Form` finds its router through a render-scoped `active` slot set only while the router renders (like the runtime's render context); outside a router render it is a plain native form. Submit listener is attached on the form element and removed by a child `scope` when the render unit is disposed. Slots `loading`/`error` use the `cond` op. The action input is always decoded from FormData (one path, same as no-JS); `form.values()` is not used. Decode failure is `keel.fields` `{ [path]: rule }` and the action is not called.
- D12: `FormHandle` (exported) = `{ pending: Signal<boolean>; values(); onResult(r: Result<Href | null, KeelError>); validate(): Result<unknown, SchemaError> }`. Sequence: `validate()` (err: stop, no request), `pending.set(true)`, run action, `pending.set(false)`, `onResult`, then revalidate or navigate. `@keel/forms` `FormState` is assignable (forms conformance 33/33 green against this router).
- D13: Scroll positions are kept in a router-owned map keyed by URL (the fixtures' history has no entry state). Saved for the committed URL whenever a navigation commits; pop restores the target URL's saved value (0 if none). `navigate` (push or replace) focuses `main` (adds `tabindex="-1"`, `preventScroll`) and scrolls to the hash target or top; initial load, pop, and revalidation do not move focus.
- D14: `Router<S>` is parameterized by route state (`createRouter` returns `Router<RouteState<M>>`); a manifest-parameterized `Router<M>` was invariant through the conditional `RouteState` and broke `ReturnType<typeof createRouter>` in fixtures. `RouteState<M>` widens to plain records when `M` has non-literal keys.
- D15: `RouteDef.component`/`errorElement` are method signatures (bivariant) so components can declare narrower props than `RouteProps`; per-route prop typing is not checked (follow-up with typed manifests).
- D16: Unsafe +2: `unsafe/toHref.ts` (brand a built path), `unsafe/narrowRoute.ts` (typed route union over the untyped computed). Both justified inline.
- D17: Loader output is validated in-process with `output.parse`; failure renders `keel.unexpected` with message E1554. Thrown loaders, guards, and actions become `keel.unexpected` via `attempt`.

## Verification
- `pnpm --filter @keel/router check`: clean. Structure lint: clean. docs-freshness, generate --check, budgets: ok.
- `pnpm --filter @keel/router test`: `fail 49 tests, 2 failed, 5 skipped` — the one failing case (counted with its file) is conformance `rules-e1501-e1506.test.ts` "E1501 string path where an Href is required": it calls `href("app.home")` in a file that imports no fixtures, so no manifest declares `app.home` and `href` throws. Believed to be a conformance bug (the test needs `import "./fixtures.ts"` or its own manifest); not changed. Everything else green; the 5 skipped are E1502-E1506 `it.todo` (checker API).
- `pnpm --filter @keel/forms test` against this router: `ok 33 tests, 0 failed, 4 skipped`.
- Forms conformance typing: `packages/forms/conformance/fixtures.ts:141` passes an action fn returning `Promise<Result<unknown, never> | Result<never, unknown>>`; the spec type is `Result<Href | null, KeelError>`, so forms' tsc reports TS2345 there. Router kept the spec type.
- Mutation: `mutate` is `echo skip` for router (backlog 0036); threshold not measured.

Test trailer (`pnpm --filter @keel/router test`): `fail 49 tests, 2 failed, 5 skipped (0.8s)` (only the E1501 conformance case)

## Follow-ups
- Typed `href` ids (codegen from routes.json or a `Register` interface) and per-route component prop checks.
- `keel check` rules for cross-module duplicate route ids and guard names (runtime is last-wins).
- Fix the E1501 conformance test via `rfc:NNNN` (register a manifest in that file).

## Next action
review
