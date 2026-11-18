# k.user: Signed-in user and caller lifetime
status: proposed

A request has two identities. `caller` (k.server, k.security) is an anonymous per-browser token: it scopes undo and stream caps, and grants nothing. `user` is the account a sign-in proves, kept by its own cookie, which `@keel/std-credentials` mints and checks (std.signin).

**User.** Guards, loaders (live ones too) and actions get `user: string` beside `caller`: the id of the account the request's sign-in cookie proves, `""` when it carries none, an unknown, ended or expired one, or when no module the deployable serves lists `@keel/std-credentials` in `deps`. `renderRoute` takes `user` as it takes `caller` (default `""`). It is resolved once per request, before guards; an event stream keeps the `user` it opened with.

**Sign-in cookie.** `__Host-keel-signin`, `Secure`, on https (k.security's rule for the caller cookie), else `keel-signin`; `HttpOnly; SameSite=Lax; Path=/; Max-Age=<seconds left>`. It is not the caller cookie and neither changes the other. `createApp({ signin })` takes the slot `@keel/std-credentials/server` exports as `signins`; the generated entries pass it when a served module lists the package, and with none `createApp` never reads or sets the cookie. A response whose request presented a cookie that proves no one clears it (`Max-Age=0`).

**Actions.** An action's `fn` also gets `signin`: `start(userId)` signs this browser in as `userId` (`Promise<Result<null, KeelError>>`; the response sets the cookie), `end()` ends this browser's sign-in, `endAll()` ends every sign-in of the request's `user`; both clear the cookie. Without the slot `start` is `err` `keel.unexpected` and the others do nothing. A loader has no `signin`: a GET signs no one in or out.

**Caller lifetime.** The caller cookie has no `Max-Age` by default: a browser quit or a shell restart is a new caller. A `node` deployable may set `caller: { days }` in `topology.ts` (an integer 1 to 400): a caller cookie it mints carries `Max-Age=<days × 86,400>`, counted from that write, never extended. The caller hash is then a long-lived device identifier: k.privacy treats it as a `.pii('network')` value, so std.sessions' capture replaces a `meta.caller` it records, and the evidence bundle's `pii.json` holds `caller: { days, class: 'network' }` (`{ days: null, class: null }` without it).

**Rules.** E1578 `caller` on a deployable other than `node`, or `days` not an integer 1 to 400 (fix: none).

**Conformance.**
- With `signins` and a user signed in through `signin.start('u1')`, a guard, a loader and an action of the next request get `user` `'u1'`; with no cookie, a forged one, or after `signin.end()`, `''`; `renderRoute(id, { user: 'u1' })` gives its loader `'u1'`.
- `start`'s response sets `__Host-keel-signin` on https with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and a `Max-Age`; `keel-signin` without `Secure` on http; the caller cookie is unchanged by it.
- A request presenting an unknown sign-in cookie gets `user` `''` and a response clearing it with `Max-Age=0`.
- Without `signins`, a request carrying a valid-looking `keel-signin` gets `user` `''`, no `set-cookie` for it, and `signin.start` is `err` `keel.unexpected`.
- A caller cookie minted with no `caller` option has no `Max-Age`; with `caller: { days: 30 }` it has `Max-Age=2592000`, and a request presenting it gets no new caller cookie.
- `caller: { days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }` and `caller` on a `client` deployable are each E1578.
- With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }`, and a std.sessions capture of a `tx` whose `meta.caller` is a hash holds a generated value in its place; without the option, `{ days: null, class: null }`.
