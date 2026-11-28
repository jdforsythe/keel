# ADR-0143: a routed app shows `unexpected` in production, as the server does (RFC 0122)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** A routed app never reaches `mount`'s root fallback: the router's `App` wraps the page in its own root boundary, whose default alert, like the level -1 fallback and every route `errorElement`, received the raw error. A page or client loader that threw therefore showed its message in a production `client` or `static` build, while a `node` deployable showed `unexpected` for the same failure through the server's `publicError`.

**Decision.**
- D1: `createRouter(routes, { ctx, history, caller?, mode? })` takes `mode: 'dev' | 'production'`, default `production`; any value but `'dev'` reads as `production`. The router reads no environment and asks no ancestor.
- D2: outside `dev`, every `keel.unexpected` the router renders or hands to app code (the default alert, the level -1 fallback, a route's `errorElement`, a `Form`'s `error` and the form handle's result) is `{ code: 'keel.unexpected', message: 'unexpected', data: {} }`. Other codes pass unchanged.
- D3: `publicError` lives in `@keel/router/internal`; the server imports it, so one function holds the rule for both.
- D4: the ctx's `error` reports, the root boundary's report and `mount`'s `onError` keep the full error in both modes. An app `Boundary`'s `fallback` keeps the full error.
- D5: the generated client entry computes `mode` once and passes it to `createRouter` and `mount`. `renderRoute` passes no `mode`, so a rendered route is the production page.

**Alternatives.**
- Read the mode from the enclosing `mount` through the owner chain: a context provider, and a router mounted by a test or by hand would depend on its caller's options.
- Drop the router's root boundary: loses the reset on the next navigation, and loader errors and `errorElement`s would still get the message.
- Sanitize only the default alert: client and server would hand an `errorElement` two different values for one failure.
- Default `dev`: a caller that forgets the option leaks the message.

**Consequences.**
- A client page and a server page show the same text for one failure; support and recorders read the message from the ctx report.
- Tests that read a thrown message from a routed page pass `mode: "dev"` or read the ctx's `error` report.
- docs/THREAT-MODEL's Mode line covers the client router.
