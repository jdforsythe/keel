# k.links: Links into a shell
status: conformance-covered

Which links on a shell's scheme (k.return) a shell takes, and how it reports its launch. A link from outside reaches a page as a web link does, a declared mount path at any time, and any other mount path only against an opening (k.opening).

**Return links.** A return link is `<id>:/<path>?<search>`, its scheme in any case, at launch or while running; other links are ignored. Keel adds nothing to it. By its path:
- A page the router matches: a client-side navigation there, at any time, as a web link to that page (guards run, loaders read).
- `handle.path` plus one of the mount's `links` (k.mount), exactly, any search: a mount request GET (k.return) at any time.
- Any other path under `handle.path` first takes the pending opening, in one `commit`, then is a mount request GET and closes the in-app Safari view. With none pending, past its deadline, or a `commit` that fails, it is ignored: no request, `keel.return` unchanged. So each opening admits one link.
- Any other path is ignored.
- Only the third kind takes an opening; the others leave it pending. A mount answer's redirect to `<id>:/<path>` is no delivered link: it is read by the same paths, needs no opening and takes none (k.return).
- **Opening.** Each time a mount request opens the external browser (which ones count: k.opening), one opening is pending until `ctx.clock.now()` reaches its deadline, 600000 ms after it. It is kept in `ctx.storage` `keel.return`, written by `set`, so it survives a relaunch. A new one replaces it.

**Launch.** A shell reports its launch once: the return links the app was launched with (none for an ordinary launch), or that it could not read them. A later report changes nothing. Until then, an opening made with no person's act (k.opening) since the ctx started is held: the browser opens, nothing is stored. A report of no link records the last held opening as of when it opened (its deadline 600000 ms after it), unless a later one was recorded or failed to store. A report of links, or of a failed read, drops it and makes the ctx link-started (k.opening) until a person acts, a reported link taken or ignored alike, then delivers the links in order. A shell that never reports records no opening before a person's act.

**Testing.** As k.return, launch included.

**Limits.** A page link is as open as a web link to that page. A declared path is reachable by any app or page at any time, with the native cookies: declaring it asserts the library's handler there is safe to receive unsolicited. While an opening is pending, another app or a web page can send a return link first: it takes the opening, its GET carries the native cookies, and the real return is ignored. A flow started outside the app returns only to a page or a declared path. A provider flow that leaves the app a second time from a return link's callback cannot return to it. Another app may register the same scheme, so a return carries nothing the library has not bound to the native store (PKCE). A declared path's own redirects are the app's to vet: one to `<id>:/<path>` reaches the path it names. Where another app can launch this one with no link, a sign-in the app starts on render with no act records an opening that app's link can take.

**Rules.** None.

**Conformance.** `/auto` is a page whose render calls `navigate(mount.href('/login/github'))`.
- `returnLink('dev.keel.golden2:/api/auth/callback?code=c')` with no opening sends nothing; after a `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a`, it sends one `net` GET of `/api/auth/callback?code=c`, and the same link again sends nothing.
- After such an opening, a link to a page navigates; a link of another scheme, or to a path neither a page nor under the mount, sends nothing; a link 600000 ms after the opening (sim clock) sends nothing, one at 599999 ms sends the GET.
- After two openings, two links send one GET. A new ctx given that ctx's `keel.return` value admits the link once.
- With no opening, `returnLink('dev.keel.golden2:/about')` navigates to `/about` and sends nothing through `net`; after an opening, that link leaves it pending: the callback link then sends one GET.
- With `links: ['/verify']` and no opening, `returnLink('dev.keel.golden2:/api/auth/verify?t=1')` sends one `net` GET of `/api/auth/verify?t=1` with `x-keel: 1` and `redirect: 'manual'`, and again on a second delivery; after an opening, it sends one GET and the callback link then one more.
- With `links: ['/verify']` and no opening, links to `/api/auth/verify/x`, `/api/auth/Verify` and `/api/auth/callback?code=c` each send nothing.
- With `launch: 'later'`, `renderRoute` of `/auto` records `https://provider.example/a` in `documents()`; after `launch([])` the callback link sends one GET; after `launch(null)` instead it sends nothing; after `launch(['dev.keel.golden2:/api/auth/callback?code=c'])` instead nothing is sent, at launch or on a later delivery.
- With no opening, `returnLink('dev.keel.golden2:/auto')` navigates to `/auto` and records `https://provider.example/a` in `documents()`; the callback link then sends nothing. After an opening, that page link leaves it pending: the callback link then sends one GET.
- With `links: ['/verify']` and no opening, the verify link answered 302 to `https://provider.example/b` records that URL in `documents()`; the callback link then sends nothing.
- With `launch: 'later'`, `renderRoute` of `/`, then `launch` of `['dev.keel.golden2:/api/auth/callback?code=c']`, of `null` or of `['dev.keel.golden2:/elsewhere']`, then the handle's `navigate('/auto')` records `https://provider.example/a` in `documents()`; the callback link then sends nothing.
- With `launch: 'later'`, `renderRoute` of `/auto` whose mount GET is answered 302 to `https://provider.example/a` only once `launch(null)` is called records that URL in `documents()`; the callback link then sends nothing. With `launch([])` instead, one GET.
