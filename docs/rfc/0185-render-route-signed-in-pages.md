# RFC 0185: k.user Testing: a `renderRoute` page is signed in for its own requests, one browser per harness

Status: implemented (ADR-0207). From walkthrough findings L6-1 and L6-2 (`tasks/p1/walkthrough-findings.md`) and scenario findings S3-1 and S3-3 (`tasks/p1/scenario3-findings.md`). Builds on RFC 0180 (`renderRoute` with `app`).

## Decisions
- D1: `renderRoute`'s `user` means the page is signed in as `user` for everything the page sends, not only for its guards, loaders and actions. The carrier is the one k.user already has for an assertion the app trusts in process: `x-keel-user`, signed by the `keel.user` signer of the binding `createApp` made on `ctx`. The receiving app uses it and runs no `identify`, as for a call between deployables. No fake session, no test credential, no `identify` stub. A test never chooses `caller`: it is the SHA-256 of a sealed token, and the binding holds only the `keel.user` signer.
- D2: router mode (no `app`). A `service({ contract })` call on `ctx` that names no `user` carries the harness's `user`. A call that names its own `user` keeps it. The user is held per `ctx` while the harness is open. A second harness opened on the same `ctx` with another `user` is E1724, since one ctx cannot tell its pages apart. On a ctx no `createApp` bound there is no signer: the harness's `user` still reaches guards, loaders and actions, a call naming no `user` goes over `ctx.net` unchanged, and a loader's call naming `user` is `api.input` (k.user Across deployables). S3-3 is that last case; the keel-testing skill says to pass the `createApp` ctx.
- D3: each harness with `app` or `shell` is one browser (k.mount Testing). With `app` the page runs on a ctx of its own: `ctx`'s clock and random (one schedule, one time) and its own empty sim storage. With `shell` it runs on the shell ctx k.return Testing makes. Every request the page sends to its origin goes through `ctx.net`: the document load, a submit, a followed redirect, a mount request, a service call, an event stream (std.channels, std.live). With `app` that net reaches `app.fetch` unless the test routed that origin; with `shell` the test routes it.
- D4: the browser's cookies live in a cookie jar the harness owns, one per harness, for the page's origin only. It is read and written at one place, the page's front on `ctx.net`: as a request to the origin enters `ctx.net`, the harness sets its `cookie` header to the jar's `name=value` pairs, replacing any the request had; when the answer comes back, the harness applies each of its `set-cookie` lines to the jar, on every hop of a redirect the harness follows and on a 3xx a `redirect: 'manual'` request receives. A line keeps its `name=value`; `Max-Age` of 0 or less, or an `Expires` before `ctx.clock`'s now, removes the name; `Path`, `Domain`, `SameSite`, `Secure` and `HttpOnly` are not read (one origin, one browser). With `app` the default route is `app.fetch`, so the jar sits around each `app.fetch` call. So `app` mints each harness's `caller` into its jar, and a sign-in through the identity mount's `handle` holds for that harness's later requests. With `shell` the jar is the native cookie store (k.shell, k.return).
- D5: the jar does not depend on the DOM environment's fetch classes. Under happy-dom a `Response` drops `set-cookie` when it is built and a `Request` drops `cookie` (Fetch's forbidden header names), and an auth library in `handle` builds its own `Response`, so no harness-side reading can recover a cookie once it is dropped. Under `keel test` the DOM is happy-dom's, but `Request`, `Response`, `Headers` and `fetch` are Node's, as on the `node` deployable the app runs on. `keelConfig` sets this up.
- D6: `user` with `app`: each request to the document's origin carries `x-keel-user` beside the jar's cookies. Without `user`, `identify` reads the cookies in the jar, so a test of the identity source signs in through the mount, as a reader does.
- D7: two users are two harnesses over one `app`. `renderRoute(id, { routes, app, ctx, user: 'u1' })` and `renderRoute(id, { routes, app, ctx, user: 'u2' })` are open at once. Each has its own container, history, browser ctx, jar, caller and user. All the server state lives in `app` on `ctx`, so a write through one page reaches the other page's open stream. No new handle or option. With `app`, `routes` may be an import (`routes: () => import(path)`): each harness's page then resumes in a module graph of its own (as `resumeDocument`), so its client stores, widget stores and islands are that harness's alone, while server state on `ctx` stays shared. An import without `app` is E1722.
- D8: E1724 rejects before any request in two cases. With `app`: a `user` on a `ctx` that holds no `createApp` binding of that `app`, which leaves no signer. Without `app`: D2's second user on one ctx. Fix: pass the `ctx` the app was created on, or use `app` for two users.
- D9: k.user, k.mount and k.return go from `conformance-covered` to `implemented` until their new clauses (k.user 11 to 13, k.mount 9 and 10, k.return 6), in the ledger at `none`, are covered. k.testing gains one Conformance bullet (the two-harness import form) and stays `conformance-covered`. Nothing becomes `frozen`.

## Problem
`apps/household/test/shoppingList.test.ts` renders `shopping.list` with `renderRoute(..., { ctx, user })` on the ctx `createApp` serves (`test/serve.ts`). The guard and the loader see `user`. Then a click on the staples menu calls `shoppingApi.add({ body }, ctx)` from the component. That call reaches `shopping.add` with `user` `''`, its `member` guard answers 403, and the page shows its failure toast. In a browser the same click carries the session cookie and succeeds. The smallest repro: `renderRoute('shopping.list', { routes, params: {}, ctx: s.ctx, user: s.user })`, then `fire('shopping.staples.trigger', { type: 'click' })` and `fire('shopping.staples.item.milk', { type: 'click' })`. The server log line is `POST /api/items shopping.add 403`, and `sent` is `[]`.

The cause:
- `packages/testing/src/renderRoute.ts:97-98` hands `user` to `createRouterWith` only, and so to guards, loaders and actions.
- `packages/services/src/internal/moduleTarget.ts:40`: on a ctx a `createApp` bound, a contract call is answered in process by `at.fetch(req)`, so neither `ctx.net` nor a test's route sees it (L4-8).
- `packages/services/src/internal/buildRequest.ts:50-56` sends `x-keel-user` only when the call's input names `user`, and component code never does: in a browser that is `api.input`.
- `packages/server/src/internal/userOf.ts:36-38`: with no header, `identify` runs on a request that carries no credential and answers `''`.

With `app`, RFC 0180's harness keeps a cookie jar (`packages/testing/src/internal/documentRoute.ts:81-103`), but it is empty in practice: happy-dom's `Response` deletes `set-cookie` in its constructor and its `Request` removes `cookie` (`happy-dom/lib/fetch/Response.js:50`, `Request.js:78`), and vitest's happy-dom environment installs both as globals. So `app` mints a new caller on every request, and a sign-in through the mount is lost on the next request (L6-2). In shell mode the harness has no cookie store at all (`renderRoute.ts:84-88`, `mountRequests`), so the round trip `examples/shell-mount` needs (a guard redirect to sign-in with `next`, a `Form` post through the mount, the return to the target page signed in) cannot be tested in process (S3-1).

The spec promises nothing here. k.user User gives `renderRoute`'s `user` to guards, loaders and actions, and its clause covers "guard and loader". k.testing names no `user`, and k.return Testing names no cookie store. This is a gap, not a bug.

Layer 7 (channels and live updates) needs two signed-in members on one app. Neither mode can express that today.

## Proposal
k.user gains a **Testing** paragraph (D1, D2, D6, D7), the E1724 rule and three clauses. k.testing's `renderRoute` signature names `user`, its `app` bullet says the page is resumed in its own browser (k.mount Testing), and its Rules list E1724, and its `app` bullet names the import form of `routes` (each harness's page in a module graph of its own, client state its own, server state on `ctx` shared) and E1722's second trigger, a `routes` import without `app`. k.mount Testing defines the harness's browser (D3), its cookie jar (D4) and the fetch classes under `keel test` (D5), with two clauses. k.return Testing sends the shell page's requests through that jar, with one clause.

One signed-in page whose component calls its API:
```ts
const ctx = createCtx({ mode: "sim", seed: 1 });
const app = await createApp({ topology, routes, ctx, deployable: "web", identity });
const t = await renderRoute("shopping.list", { routes, app, ctx, user: ada });
await t.fire("shopping.staples.item.milk", { type: "click" }); // POST /api/items as ada
```
Two members:
```ts
const a = await renderRoute("shopping.list", { routes, app, ctx, user: ada });
const b = await renderRoute("shopping.list", { routes, app, ctx, user: bob });
await a.fire("shopping.staples.item.milk", { type: "click" });
await b.settle();
expect(b.find(`shopping.name.${id}`).text).toBe("Milk × 1");
```
A sign-in through the identity mount, on a `node` page (no `user`; the auth library in `handle` sets its cookie, and `identify` reads it from the jar):
```ts
const t = await renderRoute("members.signin", { routes, app, ctx, search: { next: "/list" } });
await t.fire("members.signin.email", { type: "input", value: "ada@example.com" });
await t.fire("members.signin.password", { type: "input", value: "correct horse" });
await t.fire("members.signin.submit", { type: "click" }); // POST /api/auth/sign-in/email, 303 /list with set-cookie
expect(t.route()).toMatchObject({ id: "shopping.list" }); // the followed GET carried the session cookie
```
The same round trip in a shell (S3-1): the `api` deployable is its own `createApp`, and the test routes the page's origin to it, as the native HTTP client reaches `KEEL_ORIGIN`. The jar is the native store, so the test keeps none:
```ts
const app = await createApp({ topology, routes: api, ctx: createCtx({ mode: "sim", seed: 1 }), deployable: "api", identity });
const ctx = createCtx({ mode: "sim", seed: 2 });
ctx.net.route(new URL("/api/*", location.href).href, (req) => app.fetch(req));
const t = await renderRoute("notes.home", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
await t.fire("notes.home.toNote", { type: "click" }); // guard: redirect to notes.signin, next=/notes/n1
await t.fire("notes.signinForm:name", { type: "input", value: "Ada" });
await t.fire("notes.signinSubmit", { type: "click" }); // mount POST, 303 /notes/n1, set-cookie into the jar
expect(t.route()).toMatchObject({ id: "notes.note", params: { noteId: "n1" } }); // the guard's call carried it
expect(t.find("notes.note.title").text).toBe("Note n1");
```
A reader already signed in starts by signing in through the page, as above; the jar is not exposed, since a test that sets a cookie by hand asserts the library's cookie format rather than its behaviour.

## Alternatives
- **A derived ctx per page in router mode.** Rejected. Many registries key on ctx identity (`register`, std.channels hubs, std.tokens, the services binding), so the router's in-process loaders would split from the API. In document mode the page's own ctx is exactly what production has, which is why D3 uses it there.
- **The page's caller cookie added by the harness.** Rejected: there is no source for it. `caller` is the SHA-256 of a sealed token `app` mints, and the binding on `ctx` holds only the `keel.user` signer. The jar keeps the cookie `app` sets, as a browser does.
- **Carry cookies beside the `Request` and `Response` (a side table the server reads).** Rejected: the cookie an auth library sets is on a `Response` the library builds in `handle`, and `identify` reads `request.headers`; both are app code, and a side table would be production surface for a test need.
- **A `cookies` handle method or option to read and seed the jar.** Rejected for now: signing in through the page covers it, and seeding a library's cookie by hand couples the test to the library's format. It can be added if a test needs it.
- **The test's own route as the cookie store (status quo).** Rejected: it works only once the fetch classes keep the headers (D5), every shell test would write it, and with `app` the harness already is the browser.
- **An ambient "current page" read while `fire` runs.** Rejected: a call made after an `await`, a timer or a stream that opens at mount would lose it.
- **A `headers` or `credentials` option on `renderRoute`.** Rejected: it adds an option where `user` already says who the page is, and the app's guards would still need `identify` to read whatever the test invents.
- **A new `ServerApp` method that answers as a user.** Rejected: production surface for a test need. The binding `createApp` makes on `ctx` already signs in process.

## Spec diff
Applied in this commit, on RFC 0180's text:
- **k.user** (`implemented`, D9): a Testing paragraph and E1724 under Rules. Conformance gains clauses 11 to 13.
- **k.testing**: the `renderRoute` signature gains `user?` (k.user Testing); the `app` bullet reads "resumed as by `resumeDocument` in its own browser (k.mount Testing)"; Rules list E1724. Its Conformance gains one bullet: two harnesses of one page, with a client store and a widget each, resume and keep their own client state. Surrounding sentences in Harness, ctx, Properties and Failure output are reworded only to stay within the section budget, with no change of meaning.
- **k.mount** (`implemented`): Testing gains the harness's browser, its cookie jar and the fetch classes under `keel test`. Conformance gains clauses 9 and 10.
- **k.return** (`implemented`): Testing sends the page's requests to its origin through the jar. Conformance gains clause 6.
- **Map**: the k.user, k.mount and k.return rows read `implemented`; k.testing reads `conformance-covered`.
- **Ledger**: `k.user#11` to `#13`, `k.mount#9`, `#10`, `k.return#6` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0185`, from the spec text alone, in `packages/testing/conformance/` (with a fixture app on `createApp`, as RFC 0180's `render-route-document-support.ts`):
- k.user 11: router mode, `user: 'u1'`, on a ctx a `createApp` bound whose `identify` answers `''`. A component's contract call that names no `user` reaches the entry's guard as `'u1'`, and `identify` is not called. A call that names `user: 'u2'` arrives as `'u2'`. A second open harness on that ctx with `user: 'u3'` rejects E1724.
- k.user 12: with `app`, two harnesses on one `ctx` (`'u1'`, `'u2'`). Each page's load, submit, contract call and event stream reach `app` as its own `user`, with two distinct callers. A write through page 1 is delivered to page 2's open stream.
- k.user 13: with `app` and no `user`, `identify` runs for each page request and gets that page's caller. `user` on a `ctx` no `createApp` of `app` bound rejects E1724, and `app` receives no request.
- k.mount 9: with `app`, no `user`, and a `handle` that answers a mount `Form` POST 303 with `set-cookie: s=1; HttpOnly`: the followed GET and each later request of that page carry `s=1`, a second harness's requests do not; after an answer with `s=; Max-Age=0`, no request carries it.
- k.mount 10: under `keel test`, `new Response(null, { headers: { 'set-cookie': 'a=1' } }).headers.getSetCookie()` is `['a=1']`, and a `Request` built with `cookie: a=1` keeps it.
- k.return 6: under `renderRoute(id, { shell: true, ctx })`, with `ctx.net` routing the origin to a `createApp` whose `handle` answers a mount `Form` POST 303 to a page with `set-cookie: s=1`, the router navigates there and the page's next `service({ contract })` call carries `cookie` `s=1`.
Spec topics: `pnpm spec k.user`, `pnpm spec k.testing`, `pnpm spec k.mount`, `pnpm spec k.return`; for context `pnpm spec k.services`, `pnpm spec k.shell`.

## Build
After RFC 0180's build:
- `tooling/vitest-config.ts`: `keelConfig` runs `environment: 'happy-dom'` as a Keel environment, exported from `@keel/testing` (`./environment`): it captures Node's `Request`, `Response`, `Headers` and `fetch`, runs vitest's happy-dom environment (`builtinEnvironments` from `vitest/environments`), then defines those four globals back to Node's, and restores them at teardown. If undici refuses happy-dom's `AbortSignal` in a `Request`, `AbortController` and `AbortSignal` are Node's too, and the RFC's D5 list grows by those two. Package configs that run `renderRoute` (`packages/testing`, `packages/server`) use the same environment.
- `@keel/services`: `buildRequest` takes a default user for the target, which `moduleTarget` reads from a per-ctx table that `@keel/testing` writes while a router-mode harness is open. The table sits under a `globalThis` key, as `MODULES_KEY` does: the writer and the reader share the key, and neither imports the other.
- `@keel/testing`, router mode: register `user` for `ctx` on open and remove it at `dispose`. E1724 for a second user on one ctx.
- `@keel/testing`, one browser front (`internal/browserFront.ts`) used by document mode and shell mode: it holds the jar and wraps the page's net. For a request to the page's origin it sets `cookie` from the jar and, with `user` in document mode, `x-keel-user` from the `keel.user` signer of `ctx`'s binding, signed for the page's module; it sends through `ctx.net`; it applies `res.headers.getSetCookie()` to the jar. `documentRoute.ts`'s `request` loop and its `setCookies` go through it, one jar update per hop. Document mode builds the page's browser ctx (`ctx.clock`, `ctx.random`, a fresh sim storage, the front as its net) and routes the document origin on `ctx.net` to `app.fetch` unless the test already did. E1724 when `ctx`'s binding does not hold `app`.
- `@keel/testing`, shell mode: the shell ctx's net is the front over `ctx.net`, so `mountRequests` and module calls share the jar.
- `apps/household`: `shoppingList.test.ts` and the token panel test drive the menu, toggle, remove, mint and revoke through the page (`user`), and `test/serve.ts` drops the token-adding route where `user` covers it.
- `examples/shell-mount`: `test/shellGuard.test.ts` gains S3-1's two tests, the first as above, the second signing in first through the page; `shell()` keeps no jar of its own.
- Docs: keel-testing (`user`, two users, a sign-in round trip in document and shell mode, pass the `createApp` ctx for a loader's module call), keel-server's sentence on service calls under test, `EXPLANATIONS` for E1724.

As built: `keelConfig` preloads Node's classes into each vitest worker (`tooling/node-fetch.mjs`, `--import`) and a setup file defines them back after the environment (`tooling/node-fetch-setup.ts`), so a file's own `// @vitest-environment happy-dom` gets them too; a custom environment would not, since vitest resolves that name to its built-in one. `AbortController` and `AbortSignal` are Node's too (Node's `Request` refuses happy-dom's signal), and the `Request`, `Response` and `fetch` kept take a happy-dom `FormData` body, copied into a Node one. `@keel/schema`'s `decodeStrings` reads a `FormData` of either realm. A page's axe check leaves out the other open harnesses' pages. `@keel/ctx/internal` gains `browserCtx` (a ctx over another's clock and random, with its own net and storage), so a capability registered on it builds as on any ctx.

## Known limits
- A module store in the test's graph (a client `view` store) is one per graph, so two pages given the route table share it. With `app`, `routes: () => import(path)` gives each harness its own (k.testing).
- `document.title` and `<html lang>` are one per document; the last harness to open writes them.
- A page's request to another origin goes through `ctx.net` unchanged, without the jar, and the test's route answers it.
- Router mode without `shell` has no jar: the test's routes stand for the browser's credentials.
- Page code under `keel test` may set a `cookie` header a browser would refuse; Keel's own code sets none.

## Migration
None: unreleased.

## Token impact
k.user 7,500 to 7,367 characters. k.testing 7,500 to 7,497, the import form and its Conformance bullet paid for by rewording elsewhere in the section. k.mount 6,059 to 7,492 and k.return 4,903 to 5,274. All within the 1,875-token section budget; no budget moves.
