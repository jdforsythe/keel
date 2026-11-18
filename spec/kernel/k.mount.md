# k.mount: Pages into the identity mount
status: proposed

How a page on any deployable sends the browser to the identity source's `handle` (k.user), Keel touching no credential.

**Declaration.** `identity.ts` beside `topology.ts` default-exports `identityMount(path)` (`@keel/router`): `{ path, href }`, `path` a literal of lowercase `/` segments. `identity.server.ts` then gives `handle: { path: <its default import>.path, fn }`. `identity.ts` imports nothing server-only, so a page on any deployable imports it.
- `href(subpath?, search?)` returns a `MountHref`, an `Href` (k.router): `path`, `subpath`, then `?` and the `search` string map's keys sorted, keys and values encoded by `encodeURIComponent`; no `?` for an empty map. `subpath` is `''` or `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`; else (`//`, `..`, `?`, `#`, `%`, `\`, a scheme) it throws E1582. So the result is a root-relative path under `path`, never absolute or protocol-relative.

**Navigation.** `Link to`, `navigate` and an action's `ok(href)` take it as any `Href`. A router handles client-side only a path its table matches as a page; a link click, `navigate` or `ok(href)` to another path is a document navigation (`location.assign`; `replace`: `location.replace`). An initial load or a history pop of an unmatched path still renders the 404. Without a router (a server-rendered page) links and an action's 303 are already the browser's.

**Form.** A `<Form>` whose `action` no enclosing router matches, or with no router, submits natively; `method` must be `'POST'` when `action` is a `MountHref` (a type error otherwise). On `submit` it validates its `form` handle: errors show (k.forms) and the submit is prevented; else `pending()` is `true` and the browser posts `application/x-www-form-urlencoded` the form's named controls and the submitter's, Keel adding none. A chosen file throws E1583 and nothing is sent. `pending()` is `false` again on a `pageshow` from the back-forward cache. A queued submit (k.defaults) runs this at replay: sent once if valid, never if not.
- `.pii()` and `s.secret` fields go in the body as typed, to the page's own origin only; Keel logs no body. A URL lands in history and access logs, so none goes in `search`.
- The app's `handle.fn` answers a form post with a 303 to a page `Href` carrying its library's `set-cookie`; a rejection redirects to the form's page with a search key that route's schema declares (`?error=credentials`), which the page reads. Keel reads neither. The submitted email or password never goes back into a URL.

**Server.** A native POST under `handle.path` meets the same-site check first (k.server): same-origin passes; cross-site is 403 `keel.denied`, `fn` not called. Keel sets no cookie on a `handle` response. `form-action 'self'` (k.security) admits the post and a same-origin 303; browsers that apply it to redirects block a form post answered by a redirect to another origin, so leaving for a provider starts from a `Link` (a GET), whose redirect no directive governs.

**Origins.** `href` resolves against the page's origin, which must mount `handle`: every `node` deployable does (k.user), a `client` one through its `host`. Cookies are per origin: a sign-in on one origin is unseen by a deployable the browser reaches on another, so an app serves one public origin and forwards to peers (k.topology).

**Testing.** `renderRoute` and `resumeDocument` handles have `documents()`: the document navigations the page started, in order, `{ method, url, body }` (`body` the urlencoded text, `null` for a GET); none is made and the page stays.

**Rules.** E1580 `identity.ts` whose default export is not `identityMount('<literal>')` of lowercase `/` segments, or with no `identity.server.ts` giving `handle: { path: <its default import>.path }` (a literal there too) · E1581 a module file importing `identity.ts` where a `static` deployable, or a `client` one without `host` or with `shells`, serves the module: no origin serving it mounts `handle` · E1582 a `subpath` `href` refuses (`keel check` for a literal; the call throws) · E1583 a native submit with a file chosen. Fix: none.

**Conformance.**
- With `path` `/api/auth`, `href('/sign-in/email', { b: '2', a: 'x y' })` is `/api/auth/sign-in/email?a=x%20y&b=2` and `href()` is `/api/auth`; `'//x.example'`, `'/../x'`, `'/a/..'`, `'/a?b'`, `'/a#b'`, `'/a%2f'` and `'https://x'` each throw E1582.
- In a router, a `Link` click, `navigate` and an action's `ok` to it each record one GET in `documents()` and keep the page; a `routes.href` link navigates client-side.
- A `Form` POST to it with invalid input shows the errors and records nothing; valid, one POST whose body is exactly the named fields, no `_method`, with `pending()` `true`.
- One page module under `renderRoute` and served by `createApp` then `resumeDocument` records equal `documents()` for equal input.
- A submit queued before resume is sent once when valid, never when invalid.
- A same-origin urlencoded POST under `handle.path` reaches `fn`, a cross-site one is 403 without it; no response sets a cookie `fn` did not.
- E1580, E1581 and E1582 each have a triggering fixture and a clean one; a chosen file is E1583, nothing recorded.
