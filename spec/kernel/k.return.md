# k.return: Mount from a shell
status: implemented

How a shell page (k.shell) reaches the identity source's `handle` (k.user, k.mount) on `KEEL_ORIGIN`. The library's cookie stays in the native cookie store, as the caller cookie does; Keel reads, writes and sends no credential.

**Mount requests.** A shell build cannot leave its bundled origin by navigation, so in a ctx of `mode: 'shell'` each document navigation to a `MountHref` (k.mount) is a mount request through `ctx.net`, the `href` unchanged: a `Link` click, `navigate` or `ok(href)` is a GET; a `Form`, after the same validation, POSTs the body a browser would, with `pending()` `true` until the answer. Each carries `x-keel: 1` and `accept: application/json` (the same-site check, k.server) and `redirect: 'manual'`, which the shell's `net` honours: a 3xx resolves as it came, its `set-cookie` kept by the native store.
- Keel reads the answer's status and `location`, nothing else. A redirect to a page the router matches: a client-side navigation there. To another path under `handle.path`: a mount request GET, at most 5 in a row. To `<id>:/<path>`: read as a return link that takes no opening, its GET one of those 5. To any other URL: it opens in the external browser. A GET answered without a redirect opens its URL on `KEEL_ORIGIN` in the external browser; a POST's leaves the page as it was, `pending()` `false`.
- A shell build's `KEEL_ORIGIN` is the origin of its deployable's `host` (k.hosting), which mounts `handle`.

**External browser.** Custom Tabs on Android, an in-app Safari view on iOS, the default browser on desktop; it shares no cookie with the app or the native store.

**Return links.** Each shell registers its `id` as a URI scheme (`dev.keel.golden2:`). A return link is `<id>:/<path>?<search>`, its scheme in any case, at launch or while running; other links are ignored. Keel adds nothing to it.
- **Opening.** Each time a mount request opens the external browser (which ones count: k.opening), one opening is pending until `ctx.clock.now()` reaches its deadline, 600000 ms after it. It is kept in `ctx.storage` `keel.return`, so it survives a relaunch. A new one replaces it.
- A return link first takes the pending opening, in one `commit`. With none pending, or past its deadline, it is ignored: no request, no navigation. So each opening admits one link.
- A link that took it closes the in-app Safari view and is read as a redirect to that path on `KEEL_ORIGIN`: under `handle.path`, a mount request GET; a page, a navigation; anything else, nothing.

So OAuth runs as on the web: the library's start redirects to the provider (an opening) and sets its verifier cookie in the native store; the return to `<id>:/<callback path>` GETs with that cookie and sets the session.

**Sign-out.** A `Form` POST to the library's sign-out path, as above; its expiring `set-cookie` clears the native store. A session the external browser holds stays there.

**The app's part.** The library's cookie or token, its lifetime, rotation and revocation; the return URIs providers accept; any one-time code passed from the external browser. A token in a secure-storage plugin goes on the app's own requests as `bearer` (k.services); Keel attaches none.

**Testing.** `renderRoute(id, { shell: true })` runs the page under a ctx of `mode: 'shell'`: mount requests go to the sim `net`, `documents()` records each URL opened in the external browser as a GET, and the handle's `returnLink(url)` delivers a return link as the platform does; a passed `ctx` gives the clock and storage.

**Limits.** These need a device: that each native store keeps a cookie set on a manual redirect, and one with `Max-Age` past a relaunch; that a return link reaches a cold-started and a running app; that desktop schemes register only from an installed bundle. Another app may register the same scheme, so a return carries nothing the library has not bound to the native store (PKCE). While an opening is pending, another app or a web page can send a return link first: it takes the opening, its GET carries the native cookies, and the real return is ignored. A flow started outside the app (an emailed link) cannot return to it.

**Rules.** None.

**Conformance.**
- Under `renderRoute(id, { shell: true })`, a valid `Form` to `mount.href('/sign-in/email')` sends one `net` POST of `/api/auth/sign-in/email` with `x-keel: 1`, `redirect: 'manual'` and the urlencoded fields, records nothing in `documents()`, and on a 303 to a page navigates there client-side.
- A `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a` records that URL as one GET in `documents()` and keeps the page; answered 302 to `/api/auth/x`, a second `net` GET; a sixth redirect in a row under the mount sends nothing.
- `returnLink('dev.keel.golden2:/api/auth/callback?code=c')` with no opening sends nothing; after a `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a`, it sends one `net` GET of `/api/auth/callback?code=c`, and the same link again sends nothing.
- After such an opening, a link to a page navigates; a link of another scheme, or to a path neither a page nor under the mount, sends nothing; a link 600000 ms after the opening (sim clock) sends nothing, one at 599999 ms sends the GET.
- After two openings, two links send one GET. A new ctx given that ctx's `keel.return` value admits the link once.
- A mount answer 302 to `dev.keel.golden2:/api/auth/x`, with no opening, sends a second `net` GET of `/api/auth/x`.
- With `redirect: 'manual'`, std-capacitor's and std-tauri's `net` resolve a 303 with its `location` and no `set-cookie`, and the next request to that origin carries the cookie.
- The shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`, Tauri's deep-link schemes.
- With every GET answered 302 to `dev.keel.golden2:/api/auth/loop`, a `Link` to the mount sends six `net` GETs.
