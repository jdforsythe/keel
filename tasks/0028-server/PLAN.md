# Task 0028: server

**Spec:** k.server (also k.router Matching/Guards, k.forms Submit, k.runtime resume markup, k.errors) · **Gate:** G2 · **Branch:** jdforsythe/test-impl · **Package:** packages/server

## Deliverables
- [x] `createApp({ topology, routes, ctx, mode?, deployable?, guards?, expose?, log? }) -> Promise<{ fetch }>` over Hono (`app.all("*")`)
- [x] Request flow: match (static beats param), trailing slash 308, params fail 404 at the nearest errorElement (bare when a layout above has a loader or guard), search failing keys dropped, guards outermost first (deny: 302, or 303 for writes, with `?next=`), chain loaders started together
- [x] Status mapping: notFound 404 · denied 403 · fields 422 · unexpected 500 · other 400; production scrubs `keel.unexpected` (message `unexpected`, data `{}`); dev keeps it and adds a `data-k-dev` panel
- [x] Actions by verb or `_method`; FormData decoded with `decodeStrings`; 422 (JSON `Result`, or HTML re-render with a field summary and `form` in `#k-state`); `ok(href)`/`ok(null)` 303; runtime `Result` JSON
- [x] E1552/E1553 at `createApp` (rejection); E1554 500 with a dev `diag`
- [x] HTML document: `<!doctype html>`, chain wrapped in `<main>` unless it has one, exactly one `#k-state` `{ stores, islands, form? }`, `data-k-island` on element roots
- [x] Dev log stream via `log: { format, write }`: one `req` record per request, `diag` before it
- [x] Property tests (seed 1337); README contract (~360 tokens by chars/4); `.changeset/server-initial.md`; k.server status stays `proposed`

## Steps
1. [x] Deps: `hono`, `@keel/router`, `@keel/ctx`, `@keel/store` (workspace:*); dev `fast-check`, `@keel/reactive` (store test needs a scope).
2. [x] Implement `src/createApp.ts`, `src/types/{AppOptions,ServerApp,LogSink}.ts`, `src/internal/*` (one export per file).
3. [x] `pnpm --filter @keel/server test`: conformance green.
4. [x] Properties + examples: test/statusMapping.property.test.ts, test/formRoundTrip.property.test.ts, test/document.test.ts, test/log.test.ts (one `req` per request across every flow branch), test/internals.test.ts (pure internals); test/topology.test.ts duplicate case moved to createApp (D3).
5. [x] README, changeset, PLAN.
6. [x] Mutation: first run 59.9%; added test/internals.test.ts and flow-edge log tests; now 88.6%.
7. [x] A formatter (likely the post-write hook) reformatted conformance/fixtures.ts and conformance/post-invalid-formdata-422.test.ts (whitespace only). Restored with `git checkout`; conformance is untouched.

## Decisions
- D1: `createApp` is async (returns `Promise<ServerApp>`). Conformance fixtures call it inside promise chains and only handle rejections, so a sync throw for E1552/E1553 would fail them.
- D2: E1552 "unknown module" means a topology module that no route id belongs to (route module = first dotted segment of the id, as in `routesArtifact`). Limitation: a module without routes cannot be named yet; the right source is the k.module manifests (compiler). Follow-up.
- D3: The duplicate-module check moved from `topology()` to `createApp`. The conformance test builds the duplicate topology with `topology()` and expects `createApp` to report it. `topology()` still throws E1552 for a bad shape or empty `modules`. The old unit test was converted, not deleted. Changeset notes this as a breaking change.
- D4 (superseded by D20): the router matcher and helpers were copied into `src/internal`; the copies are deleted.
- D5: Guards. `RouteDef.guard` is a name only. It resolves in the `guards` option (registration list), then in the router registry (`guardTable`). The `Guard`-object-on-RouteDef path is removed. An unknown name gives 500 `E1506 unknown guard`.
- D6: Guard redirect is `href(redirect)` plus `next=<path+query>`, always added. The client router only adds `next` when the target's search schema declares it. The conformance test requires `next` on `app.login`, which has no search schema. Router/server mismatch; RFC candidate.
- D7: Trailing slash 308 only when the canonical path matches a pattern. An unmatched path is 404 directly, so we never redirect to a 404. This also covers fc paths like `/orders/.`, which URL parsing normalizes to `/orders/`.
- D8: Status `keel.unexpected` maps to 500 whether it was thrown or returned as an `err`. Spec: "uncaught throw 500 as keel.unexpected"; a returned keel.unexpected is treated the same.
- D9: SSR renderer (minimal; real server-mode compile is the backlog 0040 leftover). A component returning a string is HTML. A DOM `Node` is serialized (`outerHTML`, or a template for fragments and text). Arrays join. Anything else is escaped text. Layout `children` is a thunk `() => Node` (parses the child HTML; needs happy-dom). Its `toString` returns the child HTML, so string components can interpolate `${p.children}` without a cast.
- D10: A route with an `errorElement` is a render boundary. A throw renders the errorElement with `keel.unexpected` and status 500. A throw outside every boundary renders the default alert (`data-keel-error`) with 500.
- D11: `#k-state` is `{ stores: { [storeId]: snapshot }, islands: { [routeId]: { params, search, data } }, form? }`. Params, search and data are schema-encoded. Islands are recorded only for element roots, which get `data-k-island=<routeId>`. Store snapshots come from the process-wide `stores()` registry; per-request store isolation is a follow-up. JSON escapes `<`, `>`, `&`, U+2028/9.
- D12: No-JS 422: the page re-renders (loaders run) with a `role="alert"` field summary placed before the route component. The submitted values and errors go in `#k-state.form` (`{ route, method, values, errors }`). Inputs are not prefilled: that needs server-mode `<Input field>` (0040). The spec does not say how values reach inputs; RFC candidate for the `form` key.
- D13: `keel.fields` data is `{ [path]: message }` (k.forms), with messages copied from forms. The client router's `fieldsError` sends `{ [path]: rule }`. Mismatch; follow-up in router.
- D14: Runtime GET body is `{ id, results: { [levelId]: Result } }`, with status from the first failing level. Failures before loaders (404, guard error) return the `err` Result. Action runtime bodies are the `Result`.
- D15: Document action `err` other than fields: the page re-renders with the error at the route's nearest errorElement and status by code. `keel.fields` from the action re-renders at 422 like a decode failure.
- D16: Log. `LogSink` is `{ format: 'compact'|'json', write(line) }`. `req` follows the cli `ReqSchema` shape (`{kind,method,path,route?,status,ms}`). `ms` comes from `ctx.clock` (0 under sim). `diag` is emitted only for E1554. Uncaught throws have no E-code assigned, so no `diag` for them (open question).
- D17: Not streamed: the document is built as one string. Streaming and `<!--[-->` regions around route boundaries belong with server-mode compile (0040). The router App is not an island, so no resume consumer exists yet.
- D18: The `@keel/runtime-dom` dependency was dropped as unused. HTML responses always set `text/html; charset=utf-8`; HEAD gets no body.
- D19: `mode` defaults to `dev` (fixture assumption).

- D20: Shared code. `@keel/router` now exports `matchUrl`, `parseSearch`, `compileRoutes`, `compileTable`, `fieldsError`, `needsBare`, `guardTable`, `runGuard` and types `Level`, `Located`, `Match`, `Segment`, `Table`; the server imports them (matcher tests moved to router/test/matching.test.ts). `@keel/forms` exports `messageFor` (router keeps its own copy, deps order; the server needs none because `fieldsError` is the router's). Server `matchUrl(path+query)` tolerates a trailing slash; `handle` still 308s before acting.
- D21 (D-next): E1552 lives only in `createApp` (`topology()` keeps schema and empty-modules checks; it never had the duplicate check after D3).
- D22 (D-next): Cross-request state. Module-level stores on a server are process-shared data (single-process dev/demo API). Per-request state is created inside the request scope (`createApp` opens a scope per request and disposes it after the response; the registry diff around each synchronous section records created ids). `#k-state.stores` holds only those plus `createApp({ expose: [store] })`. A store created after an `await` has no owner (E1203). Proper per-request instantiation: backlog 0054.
- D23: Action responses (any status) and 302/303 redirects send `cache-control: no-store`; 308 does not.
- D24 (bug fix, no RFC; found by 0032): a `@keel/services` client sends action bodies as JSON (k.services Encoding) but actions only decoded FormData, so every service POST with a body was 422. A `content-type: application/json` request body is now parsed with the action's input schema (`input.parse`; unreadable JSON parses `undefined`); failure is the same `keel.fields` 422 and the action does not run; no `_method` override from JSON. k.server Request flow gained the clause. Test: test/jsonBody.test.ts.

## Blocked / for review
- B1 (RESOLVED): fixtures pass `guard: "auth"` and `guards: [auth]`; tsc is green. Was: `pnpm --filter @keel/server check` fails tsc only in `conformance/fixtures.ts` (10 errors; read-only). Loader/action fns return `Result<unknown, unknown>`, components return strings where `RouteDef` wants `Node`, and `guard: auth` is a `Guard` where `RouteDef.guard` is `string`. src/test are clean (tsc, biome, structure-lint). Fix: an `rfc:NNNN` PR to the fixtures, or widen `RouteDef` (`guard: string | Guard`; SSR component return type).
- B2: The dev-log-stream conformance clause is `it.todo` (no in-process API in the spec). `log` option proposed; covered by test/log.test.ts.
- B3: Router/server divergences D6 and D13. RFC candidates.

## Verification
- [x] conformance green (11 files; 2 todo: E1551 static, dev log stream) · properties present · biome clean · structure-lint clean · docs-freshness, budgets, generate --check ok
- [x] tsc green (B1 resolved)
- [x] mutation: `ok mutate server score 88.6% (threshold 70%)`
- Unsafe count 0 (unchanged).

Test trailer (`pnpm --filter @keel/server test`): `ok 73 tests, 0 failed, 2 skipped (6.7s)`
Other: `ok structure-lint 1263 files` · `ok docs-freshness 28 docs` · `ok budgets 23 measured` · biome clean · tsc 0 errors outside conformance/ (B1).

## Next action
review
