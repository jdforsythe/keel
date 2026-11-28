# ADR-0116: `renderRoute` runs server stores through the server's runner, moved to `@keel/store/internal` (RFC 0093)

**Status:** accepted

**Context.** `renderRoute` builds its page with the client router, which answers `keel.unexpected` ("stores (server state) run on a node deployable only") for any loader or action naming `stores`. A page a `node` deployable renders from server stores therefore has no `renderRoute` test: no `a11y:` claims, focus checks or Form tests. golden-1 works around it with `createApp` HTML string matches; golden-3, the S6 exit-proof app, declares `stores` on every loader and action and cannot. The store runner (`openStores`, `saveStores`) lives in `@keel/server`, above `@keel/testing` in `tooling/deps.json`, and each `createApp` keeps its own copy of saved snapshots.

**Decision.**
- The runner (`openStores`, `saveStores`, `inOrder`, `Saved`, `savedOf`, `Held`, `Opened`, `Factory`) moves from `packages/server/src/internal/` to a new internal subpath, `@keel/store/internal`, with `serverState(ctx)` (one request: `stores(factory)`, `save()`, `end()`) and `copyOf(storage)`. `@keel/store` gains `@keel/ctx` as a dependency; `tooling/deps.json` is unchanged and every import points downward.
- The copy of saved snapshots is one per `ctx.storage`, shared by every `createApp` and harness render on that ctx.
- `@keel/router/internal` exports `createRouterWith(routes, options, state?)`; the public `createRouter` passes no runner and keeps refusing `stores`.
- `renderRoute` passes `serverState(ctx)`. Each loader run (navigation, redirect target, revalidation) and each submit is one request; an action's `ok` saves (else `keel.conflict`), `err` or a throw saves none. `state` and `state()` never hold factory stores; tests seed server state through `ctx.storage`. `caller` is the option's value.
- Privacy tracking (`notePii`) stays in `@keel/server`, passed to `openStores` as a callback.
- k.testing gains one Harness sentence and two Conformance clauses (1,094 to 1,229 tokens); k.server is unchanged.

**Alternatives.**
- `createApp` plus a DOM render of its document, rejected: no client navigation to check, and a second way to render a page.
- A `@keel/server/testing` helper, rejected: two functions that render a page.
- Moving `testing` after `server` in the deps order, rejected: the harness would load the HTTP server package in every test, and the runner needs only `reactive`, `store` and `ctx`.
- The runner in `@keel/router/internal`, rejected: it does no routing.
- A public `createRouter({ stores })`, rejected: a new API shape that runs server state in a browser.
- Loader data stubs, rejected: loaders and actions under test never run.
- A copy per app and per render, rejected: a lost update between a harness and an app on one ctx.

**Consequences.**
- Every page of a `node` deployable can carry `renderRoute` tests, `a11y:` claims and Form tests; golden-3 can be built as specified.
- `@keel/server` shrinks by about 1,100 B; `@keel/testing` grows about 60 B; `@keel/router` grows about 150 B that every browser router carries unused, re-based to 10.25kb if needed; `@keel/store/internal` is a new node budget entry of 1.75kb.
- Two `createApp`s over one ctx read each other's saves and conflict on stale ones.
- A `client` deployable's route naming `stores` passes in a test and refuses in the browser until a static rule (E1558 widened, in `keel check` and `keel build`) lands; the orchestrator files that backlog line.
