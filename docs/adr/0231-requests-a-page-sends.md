# ADR-0231: k.requests: a harness logs the requests its page sends, and a route harness reads `/__keel/user` as the built app does (RFC 0209)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** A test could not show that a client-only app sends no `/__keel/user` request. A harness keeps no request log, so a test sees a request only by routing its URL, and `renderRoute` without `app` reads `/__keel/user` only when the test passes `mount`, while the built entry reads whenever the project has `identity.ts`. `examples/client-only-api`'s test passed unchanged for a project with `identity.ts`; only the built app in Chromium showed the difference.

**Decision.**
- Every harness handle has `requests()`: `{ method, url, headers }` per `fetch` its page's net was given while it was open, in order; `headers` the names as the request entered `ctx.net`, lower case, sorted; no header value, no body. A disposed handle's `requests()` is E1705.
- With `app` or `shell` the request log is that browser's, to every origin, and never `app`'s own requests. Without them it is every fetch of `ctx.net` while the handle is open.
- A fetch is logged when made: dropped, 503, offline and unrouted requests are in it. An unrouted request stays the sim net's 404 and fails no test by itself.
- A `renderRoute` router without `user` or `app` reads `/__keel/user` exactly when an identity mount was made in the test file's module graph, the first one made as its `mount`. Under vitest the `keel()` plugin evaluates the project's `identity.ts` before each test file, as the built entry imports it. `renderRoute`'s `mount` option is removed.

**Alternatives.**
- A request log on the sim net, or a `request` event on `observe`: per ctx, mixing the server's calls with the page's; observers feed recordings, a new leak path.
- Values or bodies in the request log; an error for an unrouted request; keeping `mount` with a warning; a ctx of its own for every router-mode page (capability instances would split).

**Consequences.** `examples/client-only-api`'s test asserts the request log whole, and the same test fails for an identity project. Route tests of an identity project without `user` send one `GET /__keel/user`; unrouted, `user` stays `''`. Tests that passed `mount` to `renderRoute` drop it. k.guards reads `implemented` until its two new clauses are covered; k.requests starts `proposed`. Spec map and `keel docs` budgets re-based by 10 tokens each.
