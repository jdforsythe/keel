# k.return: Mount from a shell
status: conformance-covered

How a page in a native shell (k.shell) reaches the identity source's `handle` (k.user, k.mount) on `KEEL_ORIGIN`. The auth library's cookie lands in the shell's native cookie store, as the caller cookie does, and never reaches the page; Keel reads, writes and sends no credential of its own.

**Mount requests.** A shell build cannot leave its bundled origin by navigation, so in a ctx of `mode: 'shell'` each document navigation to a `MountHref` (k.mount) is a mount request through `ctx.net`, the `href` unchanged: a `Link` click, `navigate` or `ok(href)` is a GET; a `Form`, after the same validation, POSTs the body a browser would, with `pending()` `true` until the answer. Each carries `x-keel: 1` and `accept: application/json` (the same-site check, k.server) and `redirect: 'manual'`, which the shell's `net` honours: a 3xx resolves as it came, its `set-cookie` kept by the native store.
- Keel reads the answer's status and `location`, nothing else. A redirect to a page the router matches: a client-side navigation there. To another path under `handle.path`: a mount request GET, at most 5 in a row. To any other URL: it opens in the external browser. A GET answered without a redirect opens its URL on `KEEL_ORIGIN` in the external browser; a POST's leaves the page as it was, `pending()` `false`.
- A shell build's `KEEL_ORIGIN` is the origin of its deployable's `host` (k.hosting), which mounts `handle`.

**External browser.** The platform's browser, outside the app's webview: Custom Tabs on Android, an in-app Safari view on iOS, the default browser on desktop. It shares no cookie with the app or the native store.

**Return links.** Each shell registers its `id` as a URI scheme (`dev.keel.golden2:`). A link `<id>:/<path>?<search>` the app receives, at launch or while running, closes the in-app Safari view and is read as a redirect to that path on `KEEL_ORIGIN`: under `handle.path`, a mount request GET; a page, a navigation; anything else is ignored. Keel adds nothing to it. An OAuth flow then runs as on the web: the library's start answers a redirect to the provider and sets its verifier cookie in the native store; the provider returns to `<id>:/<callback path>`; the callback's GET carries that cookie and sets the session.

**Sign-out.** A `Form` POST to the library's sign-out path, as above; its expiring `set-cookie` clears the native store. A session the external browser holds stays there.

**The app's part.** The library's cookie or token, its lifetime, rotation and revocation; the return URIs each provider accepts, and the library's trust in them; any one-time code a library passes from the external browser to the app. A token an app keeps in a secure-storage plugin goes on its own requests as `bearer` (k.services); Keel attaches none.

**Testing.** `renderRoute(id, { shell: true })` runs the page under a ctx of `mode: 'shell'`: mount requests go to the sim `net`, `documents()` records each URL opened in the external browser as a GET, and the handle's `returnLink(url)` delivers a return link.

**Limits.** These need a device: that each native store keeps a cookie set on a manual redirect, and one with `Max-Age` past a relaunch; that a return link reaches a cold-started and a running app; that desktop schemes register only from an installed bundle. Another app may register the same scheme, so a return carries nothing the library has not bound to the native store (PKCE).

**Rules.** None.

**Conformance.**
- Under `renderRoute(id, { shell: true })`, a valid `Form` to `mount.href('/sign-in/email')` sends one `net` POST of `/api/auth/sign-in/email` with `x-keel: 1`, `redirect: 'manual'` and the urlencoded fields, records nothing in `documents()`, and on a 303 to a page navigates there client-side.
- A `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a` records that URL as one GET in `documents()` and keeps the page; answered 302 to `/api/auth/x`, a second `net` GET; a sixth redirect in a row under the mount sends nothing.
- `returnLink('dev.keel.golden2:/api/auth/callback?code=c')` sends one `net` GET of `/api/auth/callback?code=c`; one to a page navigates; another scheme or path sends nothing.
- With `redirect: 'manual'`, std-capacitor's and std-tauri's `net` resolve a 303 with its `location` and no `set-cookie`, and the next request to that origin carries the cookie.
- The shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`, Tauri's deep-link schemes.
