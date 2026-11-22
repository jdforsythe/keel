# RFC 0185: k.user Testing: a `renderRoute` page is signed in for its own requests, one browser per harness

Status: accepted (ADR-0207). From walkthrough finding L6-1 (`tasks/p1/walkthrough-findings.md`). Builds on RFC 0180 (`renderRoute` with `app`), whose spec text this RFC amends in one place (D3).

## Decisions
- D1: `renderRoute`'s `user` means the page is signed in as `user`, for everything the page sends, not only for its guards, loaders and actions. The carrier is the one k.user already has for an assertion the app trusts in process: `x-keel-user`, signed by the binding `createApp` made on `ctx`. The receiving app uses it and runs no `identify`, as for a call between deployables. No new identity concept: no fake session, no test credential, no `identify` stub.
- D2: router mode (no `app`). A `service({ contract })` call on `ctx` that names no `user` carries the harness's `user`. A call that names its own `user` keeps it. The user is held per `ctx` while the harness is open. A second harness opened on the same `ctx` with another `user` is E1724, since one ctx cannot tell its pages apart. On a ctx no `createApp` bound, nothing changes: the call goes over `ctx.net`, and the test's route stands for the browser's credentials, as the keel-server skill says now.
- D3: document mode (`app`, RFC 0180). Each harness is a browser. The resumed page runs on a ctx of its own: `ctx`'s clock and random (one schedule, one time), its own empty sim storage (the browser's) and its own caller. Every request it makes to the document's origin goes through `ctx.net`: the document load, a submit, a `Link` load, a service call, an event stream (std.channels, std.live). That net reaches `app.fetch` unless the test routed that origin. With `user`, each such request carries `x-keel-user` for `user`; without it, only the caller cookie, so the app's `identify` answers. RFC 0180's "resumed on `ctx`" becomes "resumed in its own browser". The handle's `ctx` stays the test's, typed as now.
- D4: two users are two harnesses over one `app`. `renderRoute(id, { routes, app, ctx, user: 'u1' })` and `renderRoute(id, { routes, app, ctx, user: 'u2' })` are open at once. Each has its own container, history, browser ctx, caller and user. All the server state lives in `app` on `ctx`, so a write through one page reaches the other page's open stream. No new handle or option.
- D5: E1724 rejects before any request in two cases. With `app`: a `user` on a `ctx` that holds no `createApp` binding of that `app`, which leaves no signer. Without `app`: D2's second user on one ctx. Fix: pass the `ctx` the app was created on, or use `app` for two users.
- D6: k.user goes from `conformance-covered` to `implemented` until its three new clauses, in the ledger at `none`, are covered. Nothing becomes `frozen`.

## Problem
`apps/household/test/shoppingList.test.ts` renders `shopping.list` with `renderRoute(..., { ctx, user })` on the ctx `createApp` serves (`test/serve.ts`). The guard and the loader see `user`. Then a click on the staples menu calls `shoppingApi.add({ body }, ctx)` from the component. That call reaches `shopping.add` with `user` `''`, its `member` guard answers 403, and the page shows its failure toast. In a browser the same click carries the session cookie and succeeds. The smallest repro: `renderRoute('shopping.list', { routes, params: {}, ctx: s.ctx, user: s.user })`, then `fire('shopping.staples.trigger', { type: 'click' })` and `fire('shopping.staples.item.milk', { type: 'click' })`. The server log line is `POST /api/items shopping.add 403`, and `sent` is `[]`.

The cause:
- `packages/testing/src/renderRoute.ts:97-98` hands `user` to `createRouterWith` only, and so to guards, loaders and actions.
- `packages/services/src/internal/moduleTarget.ts:40`: on a ctx a `createApp` bound, a contract call is answered in process by `at.fetch(req)`, so neither `ctx.net` nor a test's route sees it (L4-8).
- `packages/services/src/internal/buildRequest.ts:50-56` sends `x-keel-user` only when the call's input names `user`, and component code never does: in a browser that is `api.input`.
- `packages/server/src/internal/userOf.ts:36-38`: with no header, `identify` runs on a request that carries no credential and answers `''`.

The spec promises nothing here. k.user User gives `renderRoute`'s `user` to guards, loaders and actions, and its clause covers "guard and loader". k.testing names no `user` at all. This is a gap, not a bug.

Layer 7 (channels and live updates) needs two signed-in members on one app. Neither mode can express that today. One ctx has one binding and so no per-page identity. A page on a second ctx runs router-mode loaders over that ctx's storage, not the server's.

## Proposal
k.user gains a **Testing** paragraph (D1 to D4), the E1724 rule and three clauses. k.testing's `renderRoute` signature names `user` and points to k.user Testing. Its RFC 0180 bullet says the page is resumed in its own browser, and its Rules list E1724.

For an app author, one signed-in page whose component calls its API:
```ts
const ctx = createCtx({ mode: "sim", seed: 1 });
const app = await createApp({ topology, routes, ctx, deployable: "web", identity });
const t = await renderRoute("shopping.list", { routes, app, ctx, user: ada });
await t.fire("shopping.staples.item.milk", { type: "click" }); // POST /api/items as ada
```
Without `app` (a router-mode test), the same `user` on the `createApp` ctx carries the call. Two members:
```ts
const a = await renderRoute("shopping.list", { routes, app, ctx, user: ada });
const b = await renderRoute("shopping.list", { routes, app, ctx, user: bob });
await a.fire("shopping.staples.item.milk", { type: "click" });
await b.settle();
expect(b.find(`shopping.name.${id}`).text).toBe("Milk × 1");
```

## Alternatives
- **A derived ctx per page in router mode.** Rejected. Many registries key on ctx identity (`register`, std.channels hubs, std.tokens, the services binding), so the router's in-process loaders would split from the API. In document mode the page's own ctx is exactly what production has, which is why D3 uses it there.
- **A cookie jar: sign in through the identity mount for each harness.** Rejected as the only path. It is slow, needs the auth library in every page test, and under happy-dom a `Response` drops `set-cookie` (L6-2). A test of `identify` itself still does this: no `user`, and the page's caller cookie reaches `identify` (D3).
- **An ambient "current page" read while `fire` runs.** Rejected: a call made after an `await`, a timer or a stream that opens at mount would lose it.
- **A `headers` or `credentials` option on `renderRoute`.** Rejected: it adds an option where `user` already says who the page is, and the app's guards would still need `identify` to read whatever the test invents.
- **A new `ServerApp` method that answers as a user.** Rejected: production surface for a test need. The binding `createApp` makes on `ctx` already signs in process.

## Spec diff
Applied in this commit (on RFC 0180's text):
- **k.user** (status `implemented`, D6): a Testing paragraph and E1724 under Rules. Conformance gains clauses 11 to 13.
- **k.testing**: the `renderRoute` signature gains `user?` (k.user Testing); the `app` bullet reads "resumed ... in its own browser"; Rules list E1724. The surrounding sentences are reworded only to stay within the section budget, with no change of meaning.
- **Map**: the k.user row reads `implemented`.
- **Ledger**: `k.user#11` to `#13` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0185`, from the spec text alone, in `packages/testing/conformance/` (with a fixture app on `createApp`, as RFC 0180's `render-route-document-support.ts`):
- k.user 11: router mode, `user: 'u1'`, on a ctx a `createApp` bound whose `identify` answers `''`. A component's contract call that names no `user` reaches the entry's guard as `'u1'`, and `identify` is not called. A call that names `user: 'u2'` arrives as `'u2'`. A second open harness on that ctx with `user: 'u3'` rejects E1724.
- k.user 12: with `app`, two harnesses on one `ctx` (`'u1'`, `'u2'`). Each page's load, submit, contract call and event stream reach `app` as its own `user`, with two distinct callers. A write through page 1 is delivered to page 2's open stream.
- k.user 13: with `app` and no `user`, `identify` runs for each page request and gets that page's caller. `user` on a `ctx` no `createApp` of `app` bound rejects E1724, and `app` receives no request.
Spec topics: `pnpm spec k.user`, `pnpm spec k.testing`; for context `pnpm spec k.services`, `pnpm spec k.topology`.

## Build
After RFC 0180's build, in the same file (`packages/testing/src/renderRoute.ts`):
- `@keel/services`: `buildRequest` takes a default user for the target, which `moduleTarget` reads from a per-ctx table that `@keel/testing` writes while a router-mode harness is open. The table sits under a `globalThis` key, as `MODULES_KEY` does: the writer and the reader share the key, and neither imports the other.
- `@keel/testing`, router mode: register `user` for `ctx` on open and remove it at `dispose`. E1724 for a second user on one ctx.
- `@keel/testing`, document mode: build the page's browser ctx (`ctx.clock`, `ctx.random`, a fresh sim storage, a net front). The front adds the page's caller cookie and, with `user`, `x-keel-user` from the `keel.user` signer of `ctx`'s binding, signed for the page's module, then sends through `ctx.net`. The harness routes the document origin on `ctx.net` to `app.fetch` unless the test already did. RFC 0180's load, submit and follow loop goes through the same front. E1724 when `ctx`'s binding does not hold `app`.
- `apps/household`: `shoppingList.test.ts` and the token panel test drive the menu, toggle, remove, mint and revoke through the page (`user`), and `test/serve.ts` drops the token-adding route where `user` covers it.
- Docs: keel-testing (`user` and two users), keel-server's sentence on service calls under test, `EXPLANATIONS` for E1724.

## Known limits
- A module store in the test's graph (a client `view` store) is one per graph, so two pages share it. A page that needs its own copy resumes with `routes: () => import(path)` (k.testing).
- `document.title` and `<html lang>` are one per document; the last harness to open writes them.
- A page's request to another origin goes through `ctx.net` unchanged, and the test's route answers it.

## Migration
None: unreleased.

## Token impact
k.user 5,997 to 7,500 characters (1,875 tokens), at the section budget. k.testing stays at 7,498, its new words paid for by trimming wording elsewhere in the section. The map row is shorter. No budget moves.
