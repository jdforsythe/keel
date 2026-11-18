# std.signin: Sign-in
status: proposed

How `@keel/std-credentials` keeps a sign-in: the token in the k.user sign-in cookie, the rows the server keeps for it, and its lifetime, rotation and end. The password check stays std.credentials'.

**Config.** `std: { '@keel/std-credentials': { signin?: { days?, idleDays?, perUser? } } }` (k.module; another value is E1158): `days`, the longest a sign-in lasts from `start`, an integer 1 to 400, default 30; `idleDays`, how long one lasts unused, 1 to `days`, default `days`; `perUser`, the sign-ins one user keeps, 1 to 256, default 32. Across modules each is the lowest set.

**Token.** `start` draws a token of std.tokens' form (`keel_<id>_<secret>`, 256 random bits) and keeps one row in the package's store `credentials.signins` (`ctx.storage`): `{ id, digest, userId, made, seen, prev? }`, `digest` the token's SHA-256, never the token; `userId` is `.pii('identifier')`. A presented token is looked up by `id` and compared to `digest` in constant time (`timingSafeEqual`); a token not in the form is not looked up. A sign-in proves its `userId` while `now < made + days` and `now < seen + idleDays`; else its row is deleted. `seen` is written at most once an hour per sign-in.

**Rotation.** A request whose sign-in is more than 24 hours old (since `made` or its last rotation) gets a new token in the response's cookie, the same `id` with a new secret; the row's `digest` becomes the new one and `prev` holds the old digest and the time. The old token still proves the user for 60 s, for requests already in flight; presented later, it ends that sign-in (a copy is in use) and proves no one. Any other secret for the `id` proves no one and ends nothing.

**Start and end.** `start(userId)` first ends the sign-in the request presented, then mints a new token: a presented or planted value is never adopted, and the caller is not a credential. Past `perUser`, the user's sign-in with the oldest `seen` ends. `end()` deletes the presented sign-in's row; `endAll()` deletes every row of the request's `user` (sign out everywhere, and after a password change). A deleted row proves no one at the next request, in every tab and device.

**Forgery and theft.** The cookie is `HttpOnly` and `SameSite=Lax`, and every write passes k.server's same-site check before anything runs, so another site cannot sign a browser in, act as it or sign it out; a GET runs no action. A copied token works until it is ended, expires, or its rotation shows a second holder. The row holds no token, so a leaked store signs no one in.

**Shells.** A shell's native client keeps the sign-in cookie in a slot of the platform's secure storage, never in its cookie store or `storage`, adds it to requests to `KEEL_ORIGIN` only, and never hands it to the page: Android, a value encrypted under a non-exportable Android Keystore key, excluded from backup; iOS, a Keychain item `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, cleared on the first start after an install; Tauri, the OS keyring (Keychain, Credential Manager, Secret Service) through the package's Rust plugin, which also carries the requests; with no keyring the slot lasts the process. A response that clears the cookie, or a passed `Max-Age`, empties the slot. So a sign-in outlives app restarts and the caller does not.

**Per user.** An outbox owner (std.outbox-owner) is `user`. Undo stays scoped by `caller` (one browser's own writes). A channel's `member` gets `user` beside `caller`; its stream caps stay per caller. std.sessions' `readers` admits a request whose `user` or `caller` it lists.

**Rules.** None (config: E1158).

**Conformance.**
- Under a sim ctx with `signins`: after `start('u1')`, `credentials.signins` holds one row for `u1` whose `digest` is the SHA-256 of the cookie's token, and no row field holds the token.
- A token with one secret character changed, or of another form, proves no one; the row stays.
- With `days: 1`, the sign-in proves `u1` at 23 h 59 m of the sim clock and no one at 24 h; with `idleDays: 1`, unused for a day, no one.
- At 25 h a request gets a new cookie token; the old one proves `u1` 59 s later and, presented at 61 s, proves no one and ends the sign-in, so the new one proves no one too.
- `start('u2')` from a browser signed in as `u1`: the old token proves no one; a planted cookie value is never the new one.
- With `perUser: 2`, a third `start('u1')` ends the sign-in with the oldest `seen`.
- `endAll()` from one of three `u1` sign-ins and one `u2`: the three prove no one, the `u2` one still proves `u2`.
- A cross-site POST (`Sec-Fetch-Site: cross-site`) to a sign-in action is 403 and sets no cookie.
- Each shell package's `net`, under its web or mock implementation: a sign-in `set-cookie` from `origin` reaches neither the page nor the cookie store, its token is sent on the next request to `origin` and on none to another origin, and a `Max-Age=0` answer empties the slot.
