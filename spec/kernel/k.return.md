# k.return: Mount from a shell
status: implemented

How a shell page (k.shell) reaches the identity source's `handle` (k.user, k.mount) on `KEEL_ORIGIN`. The library's cookie stays in the native cookie store, as the caller cookie does; Keel reads, writes and sends no credential.

**Mount requests.** A shell build cannot leave its bundled origin by navigation, so in a ctx of `mode: 'shell'` each document navigation to a `MountHref` (k.mount) is a mount request through `ctx.net`, the `href` unchanged: a `Link` click, `navigate` or `ok(href)` is a GET; a `Form`, after the same validation, POSTs the body a browser would, with `pending()` `true` until the answer. Each carries `x-keel: 1` and `accept: application/json` (the same-site check, k.server) and `redirect: 'manual'`, which the shell's `net` honours: a 3xx resolves as it came, its `set-cookie` kept by the native store.
- Keel reads the answer's status and `location`, nothing else; the router reads `user` again (k.guards Client) before it acts on them. A redirect to a page the router matches: a client-side navigation there. To another path under `handle.path`: a mount request GET, at most 5 in a row. To `<id>:/<path>`: read as a return link that takes no opening, its GET one of those 5. To any other `http:` or `https:` URL: it opens in the external browser; any other scheme is ignored. A `location` whose path begins `//` or `/\` once dot segments are removed (`/.//evil.example/x`) is ignored: nothing opens or navigates, the page stays; so is a return link with such a path (k.links). A GET answered without a redirect opens its URL on `KEEL_ORIGIN` in the external browser; a POST's leaves the page as it was, `pending()` `false`.
- A shell build's `KEEL_ORIGIN` is the origin of the `node` deployable its `servedBy` names (k.hosting), which mounts `handle`.

**External browser.** The one the shell package opens (std.capacitor, std.tauri); it shares no cookie with the app or the native store.

**Return links.** Each shell registers its `id` as a URI scheme (`dev.keel.golden2:`) in its files (std.capacitor, std.tauri). Which links on it a shell takes, and the openings that admit them: k.links, k.opening. A shell reports its launch (k.links) once its platform has read the launch links; links that arrive while running come after the report. A launch link delivered again (a webview reload) is read as any other return link.

So OAuth runs as on the web: the library's start redirects to the provider (an opening) and sets its verifier cookie in the native store; the return to `<id>:/<callback path>` GETs with that cookie and sets the session.

**Sign-out.** A `Form` POST to the library's sign-out path, as above; its expiring `set-cookie` clears the native store. A session the external browser holds stays there.

**The app's part.** The library's cookie or token, its lifetime, rotation and revocation; the return URIs providers accept; any one-time code passed from the external browser. A token in a secure-storage plugin goes on the app's own requests as `bearer` (k.services); Keel attaches none.

**Testing.** `renderRoute(id, { shell: true })` runs the page under a ctx of `mode: 'shell'`: mount requests and the page's other requests to its origin go to the sim `net` through the harness's cookie jar (k.mount Testing), `documents()` records each URL opened in the external browser as a GET, and the handle's `returnLink(url)` delivers a return link as the platform does; a passed `ctx` gives the clock and storage. It reports a launch with no link before the first render; with `launch: 'later'` it reports none until the handle's `launch(links)`, `null` for a failed read, which resolves once the links are delivered and the page has settled.

**Limits.** What needs a device or an installed bundle: the Limits of std.capacitor and std.tauri. Link-started (k.opening) is per ctx, in memory: a webview reload starts a new ctx, link-started only by its own launch report.

**Rules.** None.

**Conformance.**
- Under `renderRoute(id, { shell: true })`, a valid `Form` to `mount.href('/sign-in/email')` sends one `net` POST of `/api/auth/sign-in/email` with `x-keel: 1`, `redirect: 'manual'` and the urlencoded fields, records nothing in `documents()`, and on a 303 to a page navigates there client-side.
- A `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a` records that URL as one GET in `documents()` and keeps the page; answered 302 to `/api/auth/x`, a second `net` GET; a sixth redirect in a row under the mount sends nothing.
- A mount answer 302 to `dev.keel.golden2:/api/auth/x`, with no opening, sends a second `net` GET of `/api/auth/x`.
- With every GET answered 302 to `dev.keel.golden2:/api/auth/loop`, a `Link` to the mount sends six `net` GETs.
- A `Link` to `mount.href('/login/github')` answered 302 to `/.//evil.example/x`, or to `/\evil.example/x`, records nothing in `documents()`, sends no second `net` GET and keeps the page; `returnLink('dev.keel.golden2:/.//evil.example/x')` sends nothing and keeps the page.
- Under `renderRoute(id, { shell: true, ctx })`, `ctx.net` routing the origin to a `createApp` whose `handle` answers a mount `Form` POST 303 to a page with `set-cookie: s=1`: the router navigates there and the page's next `service({ contract })` call carries `cookie` `s=1`.
