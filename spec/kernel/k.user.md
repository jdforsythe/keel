# k.user: Request user and caller lifetime
status: conformance-covered

A request has two identities. `caller` (k.server, k.security) is an anonymous per-browser token and grants nothing. `user` is whoever the app's identity source says made the request. Keel authenticates no one: it carries what a function the app supplies answers, and never reads, writes, mints, rotates or stores a credential, session or token for it.

**Identity source.** A project may have `identity.server.ts` beside `topology.ts`, default-exporting `identity({ identify, handle? })` (`@keel/server`); each `node` deployable's generated entry passes it as `createApp({ identity })`.
- `identify({ request, caller }, ctx)` returns `Promise<string>`: a user id, `''` for no one. `request` is the incoming `Request` without its body.
- It runs once per request the deployable answers on a route (page, API route, event stream), after the same-site check and before guards; never for assets, `/__keel/*`, a forwarded path or `handle`. The kernel keeps no answer across requests.
- A throw is 500 `keel.unexpected` with a `diag` `identify threw: <name>` (the error's `name` only); an answer that is not a string of at most 256 characters is 500 with `identify returned: invalid`; past 5,000 ms on `ctx.clock`, 503 `keel.busy` (`data: { limit: 5000 }`). No guard, loader or action then runs.
- `handle: { path, fn }`: a request at `path` or under it goes to `fn(request, ctx)` with its body (`maxBodyBytes`), after the same-site check for a write; its `Response`, `set-cookie` included, is returned with k.security's headers added. An auth library's endpoints live here.

**User.** Guards, loaders (live too) and actions get `user: string` beside `caller`: `identify`'s answer; `''` with no identity source, on a `client` deployable, or under `renderRoute` without its `user` option. An event stream keeps the `user` it opened with until it closes. No header, cookie, search or body value of the client sets `user`.

**Across deployables.** A forwarded request (k.topology) keeps its headers, so the peer runs its own `identify`. A `service({ module })` method takes `user?: string`, sent as `x-keel-user`: HMAC-SHA-256 under `createApp({ secret })` over method, path, search, `user` and an expiry 60 s ahead on `ctx.clock`. A server that verifies it uses it as `user` and runs no `identify`; any other `x-keel-user` is ignored. On a ctx with no secret (a browser) `user` is `api.input`.

**User header.** The `x-keel-user` MAC also covers the body's SHA-256 (of no bytes for none) and the receiving deployable's name (`createApp({ deployable })`, else `''`). A sender answers `api.input` for a `user` over 256 characters or a stream body. A receiver ignores it on a MAC mismatch, an expiry over 65 s ahead of its `ctx.clock`, or such a `user`. It is no sign-in credential: an assertion between the app's own deployables, never sent to a browser; until it expires it replays that one request, and plain `http` between peers exposes it.

**Caller lifetime.** The caller cookie has no `Max-Age` by default: a browser quit or a shell restart is a new caller. A `node` deployable may set `caller: { days }` in `topology.ts` (an integer 1 to 400): a caller cookie it mints carries `Max-Age=<days × 86,400>`, from that write, never extended. It is still not a credential. The caller hash is then a long-lived device identifier: k.privacy treats it as `.pii('network')`, and the evidence bundle's `pii.json` holds `caller: { days, class: 'network' }` (`{ days: null, class: null }` without it). A std.sessions recording keeps no `tx` `meta`, so no `meta.caller`, whatever the lifetime.

**Rules.** E1578 `caller` on a deployable other than `node`, or `days` not an integer 1 to 400 · E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` not of lowercase `/` segments, or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). Fix: none.

**Conformance.**
- With `identify` answering `'u1'`, a guard, a loader, an action and a live loader's stream each get `user` `'u1'`, one `identify` call per request; with no identity source, `''`; `renderRoute(id, { user: 'u1' })` gives guard and loader `'u1'`.
- With `identify` answering `''`, a request carrying `x-keel-user: u2`, `?user=u2`, a body field `user` and a cookie `user=u2` gets `user` `''`.
- `identify` throwing `TypeError('t-123')`: 500 `keel.unexpected`, a `diag` naming `TypeError` without `t-123`, no guard, loader or action called; answering `42`: 500; never settling: 503 `keel.busy` at 5,000 ms on the sim clock.
- With `identify` and a `handle` whose `fn` sets `sid`, no response but `fn`'s sets a cookie other than the caller cookie; `fn`'s `set-cookie` reaches the client; a cross-site POST under `handle.path` is 403 and `fn` is not called.
- `service({ module: 'b' })` with `user: 'u1'`, in process and split: `b`'s loader gets `'u1'` and `b`'s `identify` is not called; that header resent after 61 s, to another path or with one changed character is ignored and `identify` runs; on a ctx with no secret, `api.input`.
- A caller cookie minted with no `caller` option has no `Max-Age`; with `caller: { days: 30 }`, `Max-Age=2592000`, and a request presenting it gets no new caller cookie.
- `caller: { days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, `caller` on a `client` deployable, and `handle.path` `/api` with a route `/api/x` are each one diagnostic (E1578, E1579).
- With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }`; without it, `{ days: null, class: null }`.
- With or without it, a std.sessions recording of a `tx` with `meta: { caller }` holds neither `meta` nor the hash.
- A `service({ module: 'b' })` header for `user: 'u1'` resent with another body or to deployable `c`, or signed 66 s ahead, is ignored and `identify` runs; resent unchanged within 60 s, `'u1'`. A 257-character `user`: `api.input` at the sender, ignored by the receiver.
