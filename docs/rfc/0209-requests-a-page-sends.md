# RFC 0209: k.requests: a harness logs the requests its page sends, and a route harness reads `/__keel/user` as the built app does

Status: implemented (ADR-0231), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Adds k.requests; amends k.guards (Client, Conformance), k.mount-scope (Test), k.testing (one pointer), the map. From `examples/client-only-api` (examples finding 15, backlog 1047).

## Decisions
- D1: every harness handle (`render`, `renderRoute`, `resumeDocument`) has `requests()`: one `{ method, url, headers }` per `fetch` its page's net was given while it was open, in order. `headers` are the names only, lower case, sorted, as the request entered `ctx.net` (after the jar and `x-keel-user`). No header value, no body.
- D2: whose requests. With `app` or `shell` the page is one browser on a ctx of its own, and the request log is that browser's, to every origin; `app`'s own requests are not in it. Without them the page runs on `ctx`, and the request log is every fetch of `ctx.net` while the handle is open: one ctx cannot tell its pages apart, as E1724 already says.
- D3: an unrouted request is answered as today (the sim net's 404) and logged; it never fails a test by itself. A dropped, 503 or offline request is logged too: a fetch is logged when made.
- D4: a `renderRoute` router without `user` or `app` reads `/__keel/user` exactly when an identity mount was made in the test file's module graph, with that mount as its `mount`; under vitest with the `keel()` plugin the project's `identity.ts` is evaluated before each test file, as the built entry imports it. So the read shows in a test exactly when the built app sends it.
- D5: `renderRoute`'s `mount` option goes: the mount comes from D4, the one way. `createRouter` keeps its `mount`, which the built entry passes.
- D6: no new diagnostic. A disposed handle's `requests()` is E1705.

## Problem
`examples/client-only-api/test/clientOnly.test.ts` routes every URL through `ctx.net` (GitHub, then `*` recording the rest) and asserts that the only request is GitHub's. The same test passes for a project with `identity.ts`, so it proves nothing about the opt-in rule ("an app that has not opted in makes no request"). Only the built app in Chromium shows it: the `client-only-api` smoke step records every path the static server is asked for.

What the tree does today:
- The built client entry (`packages/compiler/src/internal/entryCode.ts`) imports `/identity.ts` when the project has one and passes `mount: __keelIdentity.path` to `createRouter`. The import calls `identityMount`, which puts `readUser` into `userRead` (`packages/router/src/internal/userRead.ts`): a bundle without `identity.ts` has no code that reads.
- `renderRoute` without `app` (`packages/testing/src/renderRoute.ts`) passes `read: options.user === undefined && (options.mount !== undefined || (shell && mounts.length > 0))`. Without `shell`, the router reads only when the test passes `mount`. A test of an identity project that does not is a router that never reads, so "no `/__keel/user` request" holds whatever the project holds. k.guards Client says the `user` option stands for the answer; it says nothing of a test without one.
- Under vitest nothing evaluates `identity.ts` unless a module the test reaches imports it. A page of an identity project need not.
- No request log exists. The sim net (`packages/ctx/src/internal/simNet.ts`) keeps a route table and answers an unmatched request with a 404 naming it. A test sees a request only by routing its URL and recording in the handler, and the router's read, the jar's `cookie` and `x-keel-user` are set where a test's route cannot tell them from the app's. `documents()` (k.mount Testing) lists document navigations, recorded and not made; a `fetch` is not one.
- `browserFront` (`packages/testing/src/internal/browserFront.ts`) is the one place every request of an `app` or `shell` page passes, to its origin and to any other.

## Proposal
### The request log
`requests()` on every handle, beside `documents()` on route and resumed handles:
```ts
type SentRequest = { readonly method: string; readonly url: string; readonly headers: readonly string[] }
```
An entry per `fetch` the page's net was given, from the call that made the handle until `dispose()`, in the order made. `url` is absolute, as the net routes it. `headers` are the names as the request entered `ctx.net`, so the front's `cookie` and `x-keel-user` show by name on a request to the page's origin and not on one to GitHub: RFC 0197's rule (Keel's own headers go only to Keel origins) is assertable from the request log.

```ts fragment
// examples/client-only-api under this proposal
const page = await renderRoute("app.releases", { routes, params: {}, ctx });
await page.settle();
expect(page.requests()).toEqual([{ method: "GET", url: RELEASES, headers: ["accept"] }]);
```
In an identity project the same line fails: the first entry is the `GET /__keel/user` with `["accept", "x-keel"]`.

### No values in the request log
A test's failed `toEqual` prints both sides. Header values (a cookie, a signed `x-keel-user`, a bearer) and bodies (submitted fields) are what pii and secrets travel in, so the request log holds neither. A Keel URL holds no marked field (E1111). A test that needs a value or a body routes the URL and reads the request there, as today.

### Whose requests
With `app` or `shell`, the harness already builds one browser: a ctx of its own whose net is the front. The request log is taken there, so it holds the page's document loads, submits, each followed redirect hop, the router's read, service calls and event streams, and never a request `app` makes on `ctx` (a loader's peer call runs on the server). Without them the page runs on the test's `ctx`; the harness cannot tell its page's fetch from the test's or another harness's on that ctx, and says so rather than guessing. A test that wants a page's requests alone gives it its own ctx, as it does for two users (E1724).

### Unrouted requests
Answered as the sim net answers them, a 404, and logged. Failing the test instead would make every route test of an identity project route `/__keel/user`, and every test route each origin it does not care about. The request log makes an unrouted request visible; a test that wants strictness asserts the request log whole. Logging at the call, before the answer, puts dropped, 503 and offline requests in the request log, which is what the page sent.

### The read, as built
The request log is only as true as the harness. Without `user` or `app`, a `renderRoute` router reads when an identity mount was made in the test file's module graph, taking the first one made as its `mount`, as a bundle reads when its entry imported `identity.ts`. `shell` already takes the mounts the test made. Under vitest with the `keel()` plugin (every scaffolded `vitest.config.ts`) the plugin adds the project's `identity.ts` beside `topology.ts` to the run's setup, so it is evaluated before each test file and the mount exists for every test of the project. A package's own tests have no project: they call `identityMount` themselves.

Existing route tests of an identity project without `user` now send one `GET /__keel/user`. Unrouted it is a 404, so `user` is `''`, which is what they got; a guard waits for the read, which settles. With a `createApp` ctx whose net routes the origin to `app`, `identify` runs without cookies (router mode has no jar) and answers as for a signed-out reader.

### `mount` on `renderRoute`
Removed. With D4 it would be a second way to say the project has `identity.ts`, and a test could pass a mount the project does not have. k.mount-scope's parenthetical names where each router's `mount` comes from.

## Alternatives
- **A request log on the sim net (`ctx.net.requests()`).** Per ctx, so it mixes the server's peer calls with the page's under `app`, and outlives harnesses. The harness request log is the browser's view; the net request log would be a second one.
- **A `request` event on `observe`.** Observers feed std.sessions and the inspector; URLs in that stream are a new leak path for no test gain.
- **Header values, or bodies, in the request log.** Puts cookies, signatures and fields into assertion output. A route handler already reads them.
- **Fail an unrouted request (a new E17xx).** Every identity project's route tests would route `/__keel/user`; the request log gives the same strictness on request.
- **Keep `mount` and warn when an identity project's test omits it.** Two ways, and a rule that checks a test's options against the project.
- **Give router-mode pages their own ctx so the request log is the page's alone.** A derived ctx gets its own capability instances (`register`), so a test's `cap(ctx)` would no longer be the page's; a larger change than the finding needs.

## Spec diff
Applied in this commit.
- k.requests (new, `proposed`, owner `@keel/testing`): Request log, Whose requests, Unanswered, Rules, four Conformance clauses (#1 to #4).
- k.guards (to `implemented` until its two new clauses are covered): Client gains the read under `renderRoute` without `user` or `app` and the `keel()` plugin's evaluation of `identity.ts`; Conformance gains two clauses (#9, #10). The sentence "Under `renderRoute` its `user` option stands for the answer, and no GET is sent." is unchanged.
- k.mount-scope (stays `implemented`): Test's parenthetical: `mount` is a `createRouter` option; `renderRoute` takes the first identity mount the test made. No clause changes; `packages/testing/conformance/mount-router-scope.test.ts`, which passes `mount` to `renderRoute`, is rewritten to make the mount instead.
- k.testing (stays `implemented`): one pointer to k.requests.
- Map: k.requests row; k.guards reads `implemented`. Budgets re-based: spec map 1,430 to 1,440 tokens, `keel docs` 1,510 to 1,520 (the row), `docs/OUTPUT.md` and the map header with them.
- No new code; no glossary term.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/testing/conformance/requests-log.test.ts`: k.requests#1 to #3.
- `packages/server/conformance/requests-log-app.test.ts`: k.requests#4 (needs `createApp`; `@keel/server` already holds the `renderRoute` with `app` cases).
- `packages/testing/conformance/guard-read-in-harness.test.ts`: k.guards#9, in two files if the no-mount case needs a module graph without `identityMount` (one file per graph).
- `packages/cli/conformance/test-identity-read.test.ts`: `keel test` over a scratch project (k.guards#10), as k.test-run's last clause does.
- Existing: `packages/testing/conformance/mount-router-scope.test.ts` drops `renderRoute`'s `mount` for `identityMount` (cases with and without a mount in separate files).

## Migration
None. Nothing is released. Tests that pass `mount` to `renderRoute` (`apps/golden-2/test/canary-user.test.ts`, `packages/testing/test/renderRouteMount.test.ts`) drop it in the build.

## Token impact
- Spec: k.requests about 940 tokens; k.guards grows by about 350 to about 1,610; k.mount-scope by about 10; k.testing by about 12 to about 2,875. Map +8 tokens (re-based above).
- `@keel/testing`: one array and a wrapper on the net the page uses; `@keel/compiler/vite`: one `setupFiles` entry. Sizes measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text, budgets. 2. `conformance-writer`: the six clauses and the rewritten scope test. 3. Build:
- `packages/testing`: `SentRequest` type; `requests()` on `Harness`, `RouteHarness`, `ResumedHarness`; the request log taken in `browserFront` for `app` and `shell` pages and, for a page on `ctx`, by an internal tap on `ctx.net` from `@keel/ctx/internal` (sim and real nets) held open from the call to `dispose()`; `renderRoute` drops `mount` and passes `mount: [...identityMounts][0]?.path` with `read: options.user === undefined && mounts.length > 0`.
- `packages/ctx`: the internal net tap (no public surface).
- `packages/compiler/src/vite.ts`: under vitest, `test.setupFiles` gains the project's `identity.ts` when it exists.
- `examples/client-only-api/test/clientOnly.test.ts`: assert `requests()` whole, the GitHub header names from the request log, no `/__keel/` entry; `tasks/p1/examples-findings.md` finding 15.
- `apps/golden-2/test/canary-user.test.ts`, `packages/testing/test/renderRouteMount.test.ts`: drop `mount`. Every identity app's and example's `keel test` run, fixing any exact request list the new read changes.
- Docs: keel-testing skill (`requests()`, the read), `@keel/testing` README, changeset, `tasks/BACKLOG.md` 1047.

## For the operator
1. **Header names, no values or bodies, in the request log.** Recommended: yes; assertion output stays free of cookies, signatures and fields.
2. **An unrouted request stays a 404 and is logged, not a failure.** Recommended: yes; strictness is one `toEqual` on the request log.
3. **Without `app` or `shell` the request log is every fetch on `ctx` while open.** Recommended: yes; the page shares the test's ctx, and pretending otherwise would need a ctx per page.
4. **`renderRoute`'s `mount` option is removed; the `keel()` plugin evaluates `identity.ts` in every test file.** Recommended: yes; the harness then reads exactly when the built app does, the point of the finding.
