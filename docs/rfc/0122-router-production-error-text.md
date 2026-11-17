# RFC 0122: a routed app shows `unexpected` in production, as the server does

Status: draft. For backlog 0735 (red team 4, finding 1, HIGH). Follows RFC 0119.

## Problem
RFC 0119 made `mount`'s root fallback hold `keel.unexpected` in production. A routed app never reaches that fallback. The generated client entry calls `mount(router.App, el, { ctx, mode })`, and the router's `App` wraps the page in its own root `boundary` (`packages/router/src/internal/createRouterWith.ts:360-383`), whose fallback is `defaultError(error)`. `defaultError` writes `el.textContent = error.message` for every code but `keel.notFound` (`packages/router/src/internal/defaultError.ts:10`). The same call is the level -1 fallback in `renderView.ts:64`, and `errorAt` (`renderView.ts:9`) hands the raw error to a route's `errorElement`. So a page or client loader that throws shows its message in a production build. Red team 4 ran it with `mount(..., { mode: "production" })`:

```
/p: <div role="alert" data-keel-error="keel.unexpected">db password hunter2 SECRETTEXT</div>
/l: <div role="alert" data-keel-error="keel.unexpected">Error: loader SECRETLOADER</div>
```

The server already hides both. `publicError` (`packages/server/src/internal/publicError.ts`) gives a `keel.unexpected` the message `unexpected` and data `{}` in production, and `renderChain` passes every error through it before the default alert or an `errorElement` sees it (`renderChain.ts:34,63,70`). The same failure therefore shows `unexpected` from a `node` deployable and the thrown text from a `client` or `static` one. RFC 0119 rejected a per-app root fallback because "a route's `errorElement` already serves that need for routed apps", but with no `errorElement` the text comes from `defaultError`, which is kernel code.

## Proposal
**Mode.** `createRouter(routes, { ctx, history, caller?, mode? })` takes `mode: 'dev' | 'production'`, default `production`: the values and default of `mount`'s and `createApp`'s `mode`. The router reads no environment and asks no ancestor for it. The generated client entry (`packages/compiler/src/internal/entryCode.ts:73`) already computes `const mode = import.meta.env?.DEV === true ? "dev" : "production"` for `mount`; it moves that line above the router and passes the same `mode` to `createRouter`. One value drives both, and an unbundled entry is production.

**Rule.** Unless `mode` is `'dev'`, every `keel.unexpected` the router renders or hands to app code is `{ code: 'keel.unexpected', message: 'unexpected', data: {} }`: the default alert (root boundary and level -1), a route's `errorElement`, and a `Form`'s `error`. Other codes are values and pass unchanged, as on the server. This is `publicError` exactly, so the client page and the server page for one failure are the same text. `publicError` moves from `packages/server/src/internal/` to `@keel/router/internal`, and the server imports it from there; one function holds the rule.

**What dev shows.** With `mode: 'dev'` the router renders as today: the default alert holds the message, and an `errorElement` gets the error with its message and data.

**What still carries the message.** The router's root `boundary` reports each catch to the ctx before its fallback renders (`packages/runtime-dom/src/ops/boundary.ts:47`), and a loader or action `err` reports `error` to the ctx (k.ctx Observers). Both keep the full error, so observers, std-sessions and `mount`'s `onError` read the message in either mode.

**Author-written error boundaries.** A route's `errorElement` gets the production form, because the server already gives it that form: a route's `errorElement` sees one value whichever deployable or render path produced the page. An app `Boundary`'s `fallback` keeps the full error, as RFC 0119 decided; it is app code with no server counterpart, and the app owns what it shows.

## Alternatives
- The router reads the mode from the enclosing `mount` through the owner chain: a context provider (principle 2), and a router mounted by a test or by hand would depend on its caller's options.
- Drop the router's root `boundary` so a throw reaches `mount`'s root fallback: loses the reset on the next navigation (`resetRoot`), and loader errors at level -1 and every `errorElement` would still show the message.
- Sanitize only `defaultError`, leaving `errorElement` raw: the client and the server would hand an `errorElement` two different values for one failure, and a template like `apps/golden-1/modules/todos/ListError.tsx` that prints `error.message` would show the thrown text in a client-only app.
- Keep `data.at` in production: the server drops all data; matching it keeps one rule. `data.at` is a compiler id and still reaches observers.
- Default `dev`: a caller who forgets the option shows the message; fail closed, as `mount` and `createApp` do.

## Spec diff
k.router (before 5,995 characters, 1,499 tokens; after 5,996 characters, 1,499 tokens). To pay for the change the Scroll sentence and its conformance bullet move unchanged to k.head, which owns focus after navigation and has room; "with none or several mounted it does nothing" becomes "with none or several, nothing"; "or in the browser in a client-only app" becomes "or in a client-only app's browser". Whole new text of each changed paragraph:

Execution, first sentence:
```
**Execution.** Guards (k.guards), loaders, and actions run on the server, or in a client-only app's browser.
```

Client:
```
**Client.** `navigate(href, { replace? })` pushes or replaces a history entry. `navigate` from `@keel/router` navigates the router whose `App` encloses the caller, else the only one mounted; with none or several, nothing. `route()` is a computed of the match `{ id, params, search, pending }`, discriminated by `id`; `pending` is true while a navigation or action runs; the previous page stays rendered until the new chain's loaders finish, and the last navigation started wins. A navigation to the rendered page's path (only the search or hash differs) keeps the page when its guards and loaders succeed: no node is rebuilt. Otherwise the page renders anew. Focus and scroll: k.head. Same-origin link clicks inside a router navigate client-side. `createRouter(routes, { ctx, history, mode? })` takes `mount`'s `mode` (k.errors); unless `'dev'`, a `keel.unexpected` it renders or gives an `errorElement` or `Form` has message `unexpected` and data `{}`, as from the server.
```

Conformance: the bullet "After a push or replace to another route scroll is 0, …" leaves (to k.head); after "A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay." a new bullet:
```
- A thrown page or loader gives an `errorElement`, and the default alert, message `unexpected` and data `{}`; with `mode: 'dev'`, its message.
```

k.head (before 3,712 characters, 928 tokens; after 4,072 characters, 1,018 tokens). Client gains, as its first sentence, the sentence k.router drops:
```
**Client.** Scroll: a push or replace to another path goes to the top (or the hash target); back or forward restores each entry's; one that changes only the search, and revalidation, keep it. At `mount`, at `resume` and after each navigation's chain has rendered, …
```
Conformance gains, before "After a search-only navigation, `document.title` …", the bullet k.router drops:
```
- After a push or replace to another route scroll is 0, after a search-only one it is unchanged; back and forward restore each entry's position, also for two entries with one URL.
```

## Conformance diff
One `rfc:0122` commit by the `conformance-writer`:
- New `packages/router/conformance/production-error.test.ts`, citing the new k.router bullet: a page component that throws and a loader that throws, each mounted under `createRouter` without `mode`, render the default alert with text `unexpected` and not the thrown text; the same with an `errorElement` gives it `{ code: "keel.unexpected", message: "unexpected", data: {} }`; with `mode: "dev"` both show the thrown message; an observer on the ctx receives the full message in both modes.
- `packages/router/conformance/guard-redirect-loop-e1508.test.ts`: both client cases read the E1508 text from the page; `run` passes `mode: "dev"` to `createRouter`. A third case without `mode` asserts the alert reads `unexpected`.
- `packages/router/conformance/push-focus-scroll.test.ts:2`: the header cites k.head in place of k.router, same clause text.
- `packages/compiler/conformance/entry-mode.test.ts`: also asserts the generated client entry passes `mode` to `createRouter`.

## Migration
A client-only or static app shows `unexpected` where it showed a thrown message in production; dev is unchanged. An `errorElement` that prints `error.message` for a `keel.unexpected` shows `unexpected` in production, as it already did on a server-rendered page. A test that builds a router and reads a thrown message from the page passes `mode: "dev"` or reads the ctx's `error` report. `@keel/testing`'s `renderRoute` passes no `mode`, so rendered route tests see the production page, as RFC 0119 chose for `mount`. In this repo the router lane checks at least `packages/router/test/mutants.dom.test.ts:330-388` (E1508 alerts), `createRouterWith.test.ts:159,172` and `packages/testing/test/**` for message reads; codes are unchanged, so tests that read `data-keel-error` or `error.code` pass.

## Build order
1. Orchestrator: `spec/kernel/k.router.md`, `spec/kernel/k.head.md`. The `conformance-writer`: the conformance diff.
2. Lane A (router, sonnet): `publicError` into `packages/router/src/internal/` (exported from `@keel/router/internal`), the `mode` option in `createRouter.ts` and `createRouterWith.ts`, applied at `renderView.ts` (`errorAt`, level -1), the root boundary's fallback and the `Form` error hand-off; `packages/router/test/**`; `packages/router/README.md`; changeset (`@keel/router` minor: new option, changed default text). Runs the router suite once and `pnpm budgets` (`@keel/router` 10.75kb; the rule is a few lines, so a raise, if any, is 0.25kb and stated).
3. Lane B (server and compiler, after A): the server imports `publicError` from `@keel/router/internal` and deletes its copy (`@keel/server` patch); `entryCode.ts` passes `mode` to `createRouter`, compiler entry snapshots (`@keel/compiler` patch). Runs the server, compiler and testing suites once.
4. Orchestrator: `docs/THREAT-MODEL.md` Mode line adds the router to the client text that defaults to production; ledger, backlog 0735, HANDOFF.

## Token impact
k.router 1,499 to 1,499 tokens (5,995 to 5,996 characters); k.head 928 to 1,018 tokens (3,712 to 4,072 characters). No other section changes.

## Choices
Each is the drafter's recommendation; the operator can reverse any of them.
- C1: the router takes `mode` as an option with default `production`, set by the entry from the value it gives `mount`; it does not read it from `mount` through the owner chain.
- C2: production text is the server's: message `unexpected`, data `{}` (`publicError`), so a client page equals the server page; the default alert reads `unexpected`, while `mount`'s root fallback reads the code `keel.unexpected` (RFC 0119), because the two render different elements.
- C3: a route's `errorElement` and a `Form`'s `error` get the production form; an app `Boundary`'s `fallback` keeps the full error.
- C4: `publicError` moves to `@keel/router/internal` and the server imports it, so one function holds the rule.
- C5: to fit k.router, the Scroll sentence and bullet move to k.head, which owns focus after navigation.
