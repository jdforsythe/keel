# k.opening: Return-link openings
status: implemented

Which mount requests (k.return) record an opening, and which stored value is one. An opening admits one return link; these rules keep a return link from recording the next.

**Chains.** A chain is a mount request and each redirect Keel follows after it, a redirect to `<id>:/<path>` included (k.return Mount requests): it continues the chain it answers and counts toward its 5 in a row.
- A chain the page starts (a `Link` click, `navigate`, `ok(href)`, a `Form`) records an opening each time it opens the external browser.
- A chain a return link starts, with the GET of a link that took an opening, records none, whatever it opens. A 404, a redirect to another origin, or a redirect to a path on `KEEL_ORIGIN` that is neither a page nor under `handle.path` still opens in the external browser as k.return says, and admits no return link.

**Stored value.** `keel.return` in `ctx.storage` holds the pending opening as Keel wrote it. A value that is malformed, or whose deadline is more than 600000 ms after `ctx.clock.now()`, is no opening. When the opening cannot be stored (the write fails), the external browser still opens and that opening admits no return link.

**Testing.** As k.return: `renderRoute(id, { shell: true })`, the sim `net`, `documents()`, the handle's `returnLink(url)`, and a passed `ctx` for the clock and storage.

**Limits.** An opening is no proof that a person started a sign-in: any in-app navigation to a `MountHref` that ends in the external browser records one, including a link in content another user wrote, if the app renders such links. On Capacitor the launch URL can be delivered again after a webview reload; it is read as any other return link and needs a pending opening. A provider flow that leaves the app a second time from a return link's callback cannot return to it.

**Rules.** None.

**Conformance.** Each case starts, unless it says otherwise, with an opening: a `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a`. "The link" is `returnLink('dev.keel.golden2:/api/auth/callback?code=c')`.
- The link's GET answered 404 records `/api/auth/callback?code=c` on `KEEL_ORIGIN` in `documents()`; a second delivery of the link then sends nothing.
- The link's GET answered 302 to `https://provider.example/b`, or to `/elsewhere` (neither a page nor under the mount), records that URL in `documents()`; a second delivery then sends nothing.
- The link's GET answered 302 to `dev.keel.golden2:/api/auth/y`, whose GET is answered 404, records `/api/auth/y` in `documents()`; a second delivery then sends nothing.
- With no opening first, a `Link` to the mount answered 302 to `dev.keel.golden2:/api/auth/x`, whose GET is answered 302 to `https://provider.example/a`, records that URL in `documents()`; the link then sends one `net` GET.
- The opening made at 1 ms (sim clock): a new ctx at 0 ms given its `keel.return` value admits no link; a new ctx given the value `x` admits no link.
- With a `ctx.storage` whose writes fail, the opening still records `https://provider.example/a` in `documents()`, and the link then sends nothing.
