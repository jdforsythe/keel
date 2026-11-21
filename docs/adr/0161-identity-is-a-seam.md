# ADR-0161: identity is a seam; Keel authenticates no one (RFC 0139)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18, on the owner's direction that Keel authenticates no one). Answers the choice RFC 0132 posed for the caller cookie ("session" or "persistent") with neither as posed.

**Context.** The caller cookie is a session-only anonymous token and not a credential. Apps need to know who the user is, and golden-2 builds a sign-in by hand on the caller, so a browser quit or a shell relaunch signs the user out. The operator's direction: Keel is not an authentication library and does not take on that risk; apps plug in established libraries and platforms, and an example app may show how.

**Decision.**
- C1: the caller stays session-only and grants nothing.
- C2: an app's `identity.server.ts` default-exports `identity({ identify, handle? })`; every `node` deployable passes it to `createApp({ identity })`. `identify({ request, caller }, ctx)` answers a user id or `''`; `handle: { path, fn }` mounts a library's own endpoints, which set its own cookies. Guards, loaders and actions get `user` beside `caller`. The kernel never reads, writes, mints, rotates or stores a credential, session or token, and sets no cookie but the caller cookie.
- C3: `identify` runs once per routed request after the same-site check and before guards; nothing is cached across requests; a throw is 500, past 5,000 ms is 503.
- C4: a forwarded request is identified again by the peer; a `service({ module })` call carries `user` only when the calling code passes it, HMAC-signed under `KEEL_SECRET` for 60 s and bound to method, path and search.
- C5: event streams keep the `user` they opened with.
- C6: outbox owner is `user`; undo stays per caller; channel `member` and std.sessions `readers` see both.
- C7: a `node` deployable may set `caller: { days }` (1 to 400, E1578), classed `.pii('network')` and recorded in `pii.json`.
- C8: shells add nothing for sign-in; device smoke checks decide whether k.shell promises that a cookie with `Max-Age` outlives a relaunch.
- C9 (for the operator to confirm): golden-2's accounts module adopts a self-hosted session library behind the seam.

**Alternatives.** A durable sign-in in `@keel/std-credentials` (the rejected earlier draft: Keel would own authentication risk). A persistent caller for all (an identifier everywhere, still not authentication). `identify` in a module file (a module lives in one deployable) or in `ctx` (per-app). Actions that set headers in place of a `handle` mount. An ambient or unsigned user on module calls. Identifying each event of a stream.

**Consequences.**
- Any session library, OIDC client, JWT-verified platform or identity-injecting proxy plugs in through one function and one mount; Keel's guarantees stop at the same-site check, the source of `user`, and the signed module-call assertion.
- A sign-out reaches an open event stream only when it closes.
- `@keel/std-credentials`' future is a separate decision (RFC 0139 Open questions).

**Amendment (pages into `handle`, RFC 0139 Amendment, k.mount).** The built seam could not be reached from a page: `Form action`, `Link to`, `navigate` and `ok` take only a `routes.href` `Href`, a client router renders its own 404 for any other path, and an action has no response to carry a cookie on when it runs in the browser.
- C10: `identity.ts` beside `topology.ts` default-exports `identityMount(path)` (`@keel/router`); `identity.server.ts` gives `handle.path` as its `path`. Its `href(subpath?, search?)` makes a same-origin `Href` under `path` from a closed-charset subpath (E1582); E1580 ties the files.
- C11: a router keeps client-side only the pages its table matches; any other link, `navigate` or `ok` loads a document.
- C12: a `Form` no router intercepts validates on the client, then posts natively: urlencoded, the form's own fields, POST only to the mount, no files (E1583). The app's `fn` turns its library's answer into a 303; Keel reads none of it and sets no cookie. D4's rejection of header-setting actions stands: in the browser an action has no response.
- C13: a module importing `identity.ts` on a deployable whose origin mounts no `handle` (`static`, `client` without `host`, a shell) is E1581. Cookies are per origin, so an app serves one public origin and forwards to peers.
- Consequences: sign-in pages behave the same on every placement and server-render on `node`; an OAuth flow starts from a link because `form-action 'self'` blocks a form post's redirect to another origin; a server-rendered page's forms now validate on the client too.
