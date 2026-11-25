# k.opening: Return-link openings
status: implemented

Which mount requests (k.return) record an opening, and which stored value is one. An opening admits one return link under the mount (k.links); these rules keep a link from outside from recording the next, directly or through a page it lands on.

**Chains.** A chain is a mount request and each redirect Keel follows after it, a redirect to `<id>:/<path>` included (k.return Mount requests): it continues the chain it answers and counts toward its 5 in a row.
- A chain records an opening each time it opens the external browser, unless the ctx is link-started then or the launch holds it (k.links).
- A chain a return link starts (the GET of a declared path or of a link that took an opening) records none. What it opens (a 404, another origin, a path on `KEEL_ORIGIN` neither a page nor under `handle.path`) still opens in the external browser as k.return says and admits no return link.

**Link-started.** A ctx is link-started from the moment a delivered return link is taken (a page link navigates, a mount link sends its GET), or a launch report names links or fails (k.links), until a person next acts. Meanwhile a mount request, whoever starts it (that link's chain, a page that navigates to the mount on render, reached by the link or a guard's redirect, `navigate`, `ok(href)`), opens the external browser where k.return says and records no opening. It is read as the browser opens, per ctx, in memory only.
- A person's act is a trusted (`isTrusted`) `pointerdown`, `pointerup`, `mousedown`, `touchend`, or `keydown` other than Escape, on the page, heard at the window in the capture phase: the input a browser counts as user activation. A `click()`, `requestSubmit()` or other event the page's code dispatches is none.
- So a sign-in a page starts at a launch with no link records an opening; one a link set off records none.

**Stored value.** `keel.return` in `ctx.storage` holds the pending opening as Keel wrote it. A value that is malformed, or whose deadline is more than 600000 ms after `ctx.clock.now()`, is no opening. When the opening cannot be stored (`set` fails), the external browser still opens and that opening admits no return link; an older pending opening stays pending until its own deadline.

**Testing.** As k.links. A `fire` of `click`, `submit`, or `keydown` with a `key` other than `Escape` is a person's act; any other `fire`, the handle's `navigate` and `settle`, and events the page's code dispatches are not.

**Limits.** An opening is no proof that a person started a sign-in: after any act, whatever it was for, any in-app navigation to a `MountHref` that ends in the external browser records one, a link in content another user wrote included, if the app renders such links. A sign-in started on render of a page a link lands on opens the browser and returns to nothing: the person starts it again from a control.

**Rules.** None.

**Conformance.** Each case starts, unless it says otherwise, with an opening: a `Link` to `mount.href('/login/github')` answered 302 to `https://provider.example/a`. "The link" is `returnLink('dev.keel.golden2:/api/auth/callback?code=c')`.
- The link's GET answered 404 records `/api/auth/callback?code=c` on `KEEL_ORIGIN` in `documents()`; a second delivery of the link then sends nothing.
- The link's GET answered 302 to `https://provider.example/b`, or to `/elsewhere` (neither a page nor under the mount), records that URL in `documents()`; a second delivery then sends nothing.
- The link's GET answered 302 to `dev.keel.golden2:/api/auth/y`, whose GET is answered 404, records `/api/auth/y` in `documents()`; a second delivery then sends nothing.
- With no opening first, a `Link` to the mount answered 302 to `dev.keel.golden2:/api/auth/x`, whose GET is answered 302 to `https://provider.example/a`, records that URL in `documents()`; the link then sends one `net` GET.
- The opening made at 1 ms (sim clock): a new ctx at 0 ms given its `keel.return` value admits no link; a new ctx given the value `x` admits no link.
- With a `ctx.storage` whose writes fail, the opening still records `https://provider.example/a` in `documents()`, and the link then sends nothing.
- The link's GET answered 302 to `/auto`, a page whose render calls `navigate(mount.href('/login/github'))`, records `https://provider.example/a` in `documents()` a second time (two entries in all); a second delivery of the link then sends nothing, and after a second `Link` to the mount, a third sends one GET.
- With no opening first, a `fire` `click` on a `Link` to `/auto` records `https://provider.example/a` in `documents()`; the link then sends one GET.
- With no opening first, a `fire` `submit` of a valid `Form` whose action answers `ok(mount.href('/login/github'))` records `https://provider.example/a` in `documents()`; the link then sends one GET.
- An opening at 0 ms (sim clock), then a second at 300000 ms with a `ctx.storage` whose `set` now fails, its `commit` still working: the link at 599999 ms sends one GET; delivered first at 600000 ms instead, it sends nothing.
- With no opening first, `renderRoute` of `/auto` with no `fire` records `https://provider.example/a` in `documents()`; the link then sends one GET.
- The link's GET answered 303 to `/`, then a `fire` `input` on a field and the handle's `navigate('/auto')`, records `https://provider.example/a` in `documents()`; a second delivery of the link then sends nothing. With a `fire` `keydown` `Escape` on the field instead it sends nothing; with `keydown` `a`, one GET.
- With no opening first, over any sequence of `fire` `keydown` `a`, `navigate('/auto')` and deliveries of the link, each answered 303 to `/`, a `navigate` records an opening unless a delivery was taken since the last act, and a delivery sends one GET exactly when an opening is pending, taking it.
- With a `ctx.storage` whose `commit` fails, the link sends nothing; a new ctx given that ctx's `keel.return` value then admits the link once.
- The link's GET answered 302 to `/private`, a page whose guard redirects every reader to `/auto`, records `https://provider.example/a` in `documents()` a second time (two entries in all); a second delivery of the link then sends nothing.
- With no opening first, over any sequence of `fire` `keydown` `a`, `navigate('/private')` and deliveries of the link, each answered 302 to `/private`, a `navigate` records an opening unless a delivery was taken since the last act, and a delivery sends one GET exactly when an opening is pending, taking it.
