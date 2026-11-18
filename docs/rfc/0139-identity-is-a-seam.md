# RFC 0139: identity is a seam: the app says who the user is, Keel authenticates no one

Status: draft, for the orchestrator to accept (ADR-0161). This text replaces an earlier draft of the same number, which put a durable sign-in inside `@keel/std-credentials` and which the operator rejected: Keel is not an authentication library and does not take on that risk; apps plug in established libraries and platforms.

## Problem
Each claim below was read in the code on 2026-11-18.

The caller cookie (`packages/server/src/internal/callerOf.ts`, `CALLER_COOKIE.ts`, `issueCaller.ts`) is `__Host-keel-caller` (https, `Secure`) or `keel-caller`, `HttpOnly; SameSite=Lax; Path=/`, with no `Max-Age`: an anonymous per-browser token minted on the first write, HMAC-signed, whose SHA-256 loaders and actions see as `caller`. `docs/THREAT-MODEL.md` (Caller identity): "It is not authentication: anyone who holds the cookie is that caller."

Server code has no other identity. golden-2's `accounts` module builds sign-in on the caller: `Session.schema.ts` is `{ caller, userId }`, `submitSignIn.server.ts` writes it after `credentials(ctx).verify`, `loadAccount.server.ts` and `postToken.server.ts` find the session by `caller`. That is an authentication system written by hand in a golden app, and it lasts as long as the caller cookie: a browser quit, or any shell relaunch, signs the user out (Capacitor removes session cookies at start and stop, iOS keeps them for the process, Tauri saves only persistent cookies: `tasks/0338-s8-reach/proposed/s8-shells.md`, RFC 0132 Proposal 4). Outbox entries queued under the signed-in owner (std.outbox-owner: "the signed-in user's id, else ''") are then refused with `offline.owner`.

Other per-person readers of `caller`: std.sessions' guard `sessions.reader` admits a `caller` hash listed in `readers`; std.channels' `member` gets `caller`; undo is scoped by `tx` meta `{ caller }` (golden-1 `postUndo.server.ts`).

Apps need to know who the user is, and they need that answer to come from a library or platform that owns the risk: password storage, sessions, rotation, revocation, OAuth and OIDC flows, MFA. Keel today offers no place to plug one in: app code cannot set a cookie (an action returns a `Result`), cannot mount a handler that returns its own `Response`, and has no per-request identity other than `caller` and an API route's `bearer`.

## Proposal
One new section, status proposed: `k.user` (the seam, `user`, caller lifetime). Keel carries an identity the app supplies and never produces one.

### D1. The caller stays session-only and grants nothing
No `Max-Age` by default; a browser quit or shell restart is a new caller. It is an anonymous per-browser token, not a credential, and nothing in this RFC changes that. Alternative rejected: **a persistent caller for everyone** (RFC 0132's second option: a 400-day identifier in every browser that still authenticates no one).

### D2. The identity source: one project file, `identity.server.ts`
`identity.server.ts` beside `topology.ts` default-exports `identity({ identify, handle? })` from `@keel/server`. Each `node` deployable's generated entry (`server.mjs`, `keel dev`, in-process peers) imports it and passes `createApp({ identity })`; server tests call `createApp({ identity })` directly.
- `identify({ request, caller }, ctx) => Promise<string>`: a user id, or `''` for no one. `request` is the incoming `Request` without its body (method, URL, headers, cookies); `caller` is k.server's, for apps that key anything off it.
- The kernel never reads, writes, mints, rotates or stores a credential, session or token for the app. The only cookie the kernel sets stays the caller cookie.

Why a project file: every `node` deployable must identify the requests it answers, and a module lives in exactly one deployable (k.topology), so a module file cannot serve a split topology. Alternatives rejected: **`createApp({ identify })` alone** (apps never write `createApp`; the generated entries do); **a module file `modules/<id>/identify.server.ts`** (only the deployable serving that module would identify); **a `topology.ts` field** (topology is read statically and names no functions); **`user` in `ctx`** (`ctx` is the same for every request, k.ctx; per-request identity is an argument, as `caller` and `bearer` are).

### D3. When `identify` runs, and what failure means
- Once per request the deployable answers on a route (page, API route, event stream), after the same-site check and before guards. Never for assets, `/__keel/*`, a path it forwards to a peer, or `handle`. Requests that never reach a route never pay for it.
- The kernel keeps no answer across requests: two requests with the same cookies call `identify` twice. The function may cache what its library caches (a JWKS, for example); that is the app's.
- A throw or rejection: 500 `keel.unexpected`, a `diag` `identify threw: <name>` naming the error's `name` only (a message may quote a token), and no guard, loader or action runs. Alternative rejected: **treat it as no user** (an outage of the identity provider would silently sign everyone out and let anonymous writes proceed under owner `''`).
- An answer that is not a string of at most 256 characters: 500, `diag` `identify returned: invalid`.
- Slow: past 5,000 ms on `ctx.clock`, 503 `keel.busy` with `data: { limit: 5000 }`; the function can bound itself lower. Alternatives rejected: **no bound** (a hung provider holds every request open); **an option** (a knob for a value the function already controls).

### D4. `handle`: where a library's own endpoints live
`handle: { path, fn }`: a request at `path` or under it goes to `fn(request, ctx)`, the full `Request` with its body capped at `maxBodyBytes`; the `Response` `fn` returns, `set-cookie` included, is sent with k.security's headers added. A write there passes the same-site check first. A route of any deployable at or under `path`, or a `path` not of lowercase `/` segments, is E1579. Every library surveyed below needs endpoints that set its own cookies (sign-in, OAuth callback, sign-out); without a mount only header-borne identities would fit. Alternatives rejected: **actions that set response headers** (every action would gain cookie control, and the action `Result` shape would change for all apps); **no mount** (excludes session libraries and OIDC clients); **exempting `handle` from the same-site check** (would let a cross-site form reach a library endpoint; the OIDC `form_post` case is an Open question). A page reaches `handle` only through the Amendment (k.mount): an `Href` under `handle.path` from `identity.ts`, a `Link` or a native `<Form>` post; without it no page could link or post there.

### D5. `user` beside `caller`
Guards, loaders (live too) and actions get `user: string`: `identify`'s answer; `''` with no identity source, on a `client` deployable, or under `renderRoute` without its new `user` option. No header, cookie, search or body value of a client sets it. A client-only deployable knows nothing authoritative about the user; it may show a display copy a loader returned (golden-2's `accounts.me`), and the server decides every write.

### D6. Across deployables
Verified in `packages/server/src/internal/forward.ts`: a forwarded request keeps every header but hop-by-hop ones and adds `x-keel-forwarded: 1` (a loop guard any client can send); nothing in it is signed. `service({ module })` requests (`packages/services/src/internal/buildRequest.ts`) carry `accept`, `x-keel: 1` and an optional `authorization`, and no cookie, so the callee sees no caller today.
- A forwarded request: the peer runs its own `identify` on the headers it receives, with the same `identity.server.ts`. No identity travels in a header the client could write.
- A `service({ module })` call: a client method takes `user?: string`, sent as `x-keel-user: <user>.<expiry>.<mac>`, the MAC an HMAC-SHA-256 under `createApp({ secret })` (`KEEL_SECRET`, already shared by the app's deployables so `caller` agrees) over method, path, search, `user` and an expiry 60 s ahead on `ctx.clock`. A server that verifies it uses it as `user` and runs no `identify`; any other `x-keel-user` is ignored and `identify` runs. On a ctx with no secret (a browser) `user` is `api.input`. In process and split give the same `user`, as k.topology requires of every call.

Alternatives rejected: **an ambient current-request user attached to every call** (action at a distance, principle 2; `ctx` is per app, so a call has no request to read); **forwarding the request's cookie and `authorization` on module calls** (a proxy header or another credential would not cross, and the callee's `caller` would change meaning); **an unsigned header** (any client could send it).

### D7. Long connections identify at open
A live loader's or channel's event stream gets the `user` `identify` answered when it opened and keeps it until it closes. Consequence: a sign-out or a revocation the library makes reaches an open stream only when it closes. The client router closes a page's streams on navigation, so the tab that signs out stops its own; other tabs and devices keep theirs until they close. A channel's `member` runs at open, at each publish (the publisher's request, freshly identified) and after each save, and sees the opener's `user` for the last. Alternative rejected: **identify per event** (a provider call per event, and no defined answer for a stream whose `identify` fails midway).

### D8. Per-user keys
- Outbox owner (std.outbox-owner): the request's `user`; an app writes `writeFor(input.write, user)`. Queued writes survive a relaunch whenever the library's sign-in does.
- Undo: stays scoped by `caller` (a browser undoes its own writes). An app that wants undo per user records `meta: { user }` and scopes `undoWhere` on it; the kernel's documented form does not change.
- Channels: `member` gets `user` beside `caller`; caps stay per caller.
- std.sessions `readers`: admits a request whose `user` or `caller` it lists; listing user ids keeps a reader across browser restarts.

### D9. A persistent caller, opted in per `node` deployable
Kept from the earlier draft. `caller: { days }` on a `node` deployable in `topology.ts` (an integer 1 to 400, else E1578): a caller cookie it mints carries `Max-Age=days × 86,400`, from that write, never extended. It is continuity without accounts (golden-3's "my sign-ups" and organizer list), cookie lifetime for an anonymous identifier, and still not a credential. Privacy: the caller hash is then a long-lived device identifier, so k.privacy treats it as `.pii('network')`: std.sessions' capture replaces a recorded `meta.caller`, and `pii.json` records `caller: { days, class: 'network' }` (`{ days: null, class: null }` without it). Alternatives rejected: **per app** (a peer's cookies are its own origin's); **sliding or unbounded** (an identifier that never ends).

### D10. Testing
`renderRoute(id, { user })` as `{ caller }` (default `''`). Server tests and sim runs pass `createApp({ identity: identity({ identify: async () => 'u1' }) })` under a sim ctx; a library's real `identify` is integration-tested by the app against the library's own test setup. Nothing in `@keel/testing` knows any library.

### D11. Shells
A durable sign-in in a shell is the library's or platform's. Keel provides no secure slot and no auth plugin. What the shells must not break, from the code:
- **Android** (`KeelHttpPlugin.java`): `HttpURLConnection` uses the default `CookieHandler`, which `CapacitorCookies.load()` sets to `CapacitorCookieManager` (`@capacitor/android` 8.6.2), backed by the WebView's `android.webkit.CookieManager`; each `set-cookie` is written through `setCookie` and then `flush()`, and start and destroy call only `removeSessionCookies()`. So a cookie with `Max-Age` is written to the WebView cookie database and is not removed by Capacitor at relaunch.
- **iOS** (`KeelHttpPlugin.swift`): `URLSession(configuration: .default)`, so `HTTPCookieStorage.shared`; `@capacitor/ios` 8.6.2 clears cookies only on the page's `clearCookies`/`clearAllCookies` calls, never at load. Whether `HTTPCookieStorage.shared` keeps a persistent cookie across a relaunch is the platform's behaviour, not in this repository.
- **Tauri** (`tauriNet.ts` over `@tauri-apps/plugin-http` 2.9.0): the crate's cookie jar saves cookies whose `is_persistent()` is true to `.cookies` in the app cache directory (crate source, read in the s8-shells report); a cookie with `Max-Age` is persistent.
- All three: `set-cookie` never reaches the page (Android and iOS drop it from the headers they resolve; `tauriNet.ts` deletes it), cookies go only to their origin (std.shells), and the global `fetch` is unpatched. An `authorization` header the app sets passes through unchanged.
- Each store is a file in the app's private data, not encrypted by Keel (WebView cookie database, `Cookies.binarycookies`, `.cookies`). A library or platform that needs a secure slot brings its own native plugin; the shell must not block one.

Open checks for a shell smoke, not asserted here: on each platform, a cookie set with `Max-Age=86400` through `net` is sent again after a force-stop and relaunch; on iOS, after a relaunch from the app switcher and after a reboot; on Tauri, after a crash (is `.cookies` written only at a clean exit?) and after the OS clears the cache directory; on Android, whether the WebView cookie database is in Auto Backup.

## Examples (non-normative)
A survey of maintained options, 2026-11, to show the seam fits each kind. Library names appear here only; the spec states the contract. Each was read in its current documentation; versions move, and the build re-checks the one golden-2 adopts.

**E1. A self-hosted session library for Node** (Better Auth). Needs from a host: a mount for its Web `Request` to `Response` handler at a base path (default `/api/auth`), which sets and clears its own session cookie, and a way to read the session from the request's headers (`auth.api.getSession({ headers })`, `null` when signed out). Keeps users and sessions in its own database through its adapter, not `ctx.storage`. Its email sign-in and sign-out endpoints take a POST and answer 200 JSON with `set-cookie`, so for a page's native form post the app's `fn` turns that answer into a 303 (Amendment, k.mount).
```ts
// identity.ts (imported by pages on any deployable)
export default identityMount('/api/auth')

// identity.server.ts
import mount from './identity.ts'
import { routes } from './modules/accounts/routes.ts'
const posted = (r: Request) => r.method === 'POST' && (r.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')
export default identity({
  identify: async ({ request }) => (await auth.api.getSession({ headers: request.headers }))?.user.id ?? '',
  handle: { path: mount.path, fn: async (request) => {
    const res = await auth.handler(request)
    if (!posted(request)) return res
    const to = res.ok ? routes.href('accounts.me') : routes.href('accounts.signin', undefined, { error: 'credentials' })
    const headers = new Headers({ location: to })
    for (const c of res.headers.getSetCookie()) headers.append('set-cookie', c)
    return new Response(null, { status: 303, headers })
  } },
})

// SigninPage.tsx: the sign-in form and a sign-out button (a POST, so the same-site check covers it)
<Form method="POST" action={mount.href('/sign-in/email')} form={f}>…</Form>
<Form method="POST" action={mount.href('/sign-out')}>{() => <Button type="submit">Sign out</Button>}</Form>
```
The sign-in route declares `search: { error?: 'credentials' }` and shows a message for it; the email the person typed is not put back into the URL. Sign-out is a form, not a link: a GET is outside the same-site check, so any site could sign the person out with a link or an image.
Auth.js core (`Auth(request, config)` returns a `Response`; its session is a GET of its session action with the request's cookie; base path `/auth` outside Next.js) fits the same way.

**E2. An OAuth/OIDC client library** (openid-client 6: `discovery`, `randomPKCECodeVerifier`, `calculatePKCECodeChallenge`, `buildAuthorizationUrl`, `authorizationCodeGrant`). Needs: a login endpoint that keeps a PKCE verifier and `state` in a short-lived `SameSite=Lax` cookie and redirects to the provider; a callback endpoint at the registered redirect URI that reads the query and that cookie and exchanges the code; then a session of its own, which the library does not keep (pair it with E1 or a signed cookie from a session library). Both endpoints live in `handle`; the callback is a top-level GET, which the same-site check does not touch. The page starts the flow with a link, `<Link to={mount.href('/login/github')}>Sign in with GitHub</Link>`: a GET document navigation that `fn` answers with a 302 to the provider. Not a form: `form-action 'self'` blocks a form post's redirect to another origin in browsers that apply it to redirects (k.mount). A library whose sign-in-with endpoint is a POST answering JSON `{ url }` (E1's social sign-in) gets a GET route in `fn` that calls it and answers the 302 with its `set-cookie`.

**E3. A hosted identity platform verified by JWT** (jose: `createRemoteJWKSet(url)`, `jwtVerify(token, jwks, { issuer, audience })`). Needs: the token from `authorization` or a cookie, and the platform's JWKS over the network, cached in process by the library. `identify` reads the token and returns the verified `sub`. The platform's hosted sign-in page is reached by redirect (E2's flow, or the platform's own callback in `handle`). Its embedded browser widgets need script and connect sources the content security policy refuses (k.security has no option), so they do not run in a Keel page.
```ts
const jwks = createRemoteJWKSet(new URL('https://id.example.com/.well-known/jwks.json'))
export default identity({ identify: async ({ request }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '')
  if (!token) return ''
  return (await jwtVerify(token, jwks, { issuer: 'https://id.example.com/', audience: 'app' })).payload.sub ?? ''
} })
```

**E4. A reverse proxy or edge that injects identity** (oauth2-proxy passes `X-Forwarded-User` and `X-Forwarded-Email` upstream by default and strips a client's copies). Needs: nothing from the host but reading a header. `identify` returns that header. It is only as good as the network: the deployable must be reachable only through the proxy, or any client sets the header. Edges that send a signed assertion are verified as E3.

## Spec diff
- `spec/kernel/k.user.md`, status proposed, rewritten: intro, Identity source, User, Across deployables, Caller lifetime, Rules (E1578, E1579), eight Conformance bullets. 5,169 characters, 1,293 tokens.
- `spec/std/std.signin.md` deleted (proposed, referenced by no conformance file), with its `spec/std/README.md` row.
- `spec/00-map.md`: the `k.user` row's title becomes "Request user and caller lifetime", its cell `identify`. 1,192 tokens.
- Codes: E1578 kept (caller days); E1579 allocated (identity source). No other code is used or freed.
- No bullet of another section changes, so the ledger does not move. Sentences that describe today's code change with the build (commit 3), each within its budget (characters as `pnpm budgets` counts them):
  - std.outbox-owner intro: "…another owner than the one its caller is signed in as when the action runs." to "…another owner than the request's `user` when the action runs."; Write: "`owner` being the id its module gives the request's `caller` (k.server): the id its pages give `send` and `drain`, `""` for a caller signed in as no one." to "`owner` being the request's `user` (k.user): the id its pages give `send` and `drain`, `""` for no one."; its code line `writeFor(input.write, user)`. 2,486 to about 2,400.
  - std.channels: the example's `member: ({ caller, user, params, stores }) => true`; "`member` is a pure predicate over the request's `caller`, the parsed `params`" to "over the request's `caller` and `user` (k.user), the parsed `params`". 5,961 to 5,989.
  - std.sessions Ingest: "loads it behind guard `sessions.reader`: `caller` in `readers`, else 403 `keel.denied`." to "loads it behind guard `sessions.reader`: `user` or `caller` in `readers`, else 403." (a guard denial on an API route is `keel.denied` by k.api). 5,999 to 5,995.
  - k.guards: "`caller` is k.server's `caller` (`''` if none or client-only);" to "`caller` and `user` are k.server's and k.user's (`''` if none or client-only);". 1,219 to about 1,240.
  - k.server, k.testing and k.services are at 5,993, 5,987 and 5,208 characters; k.user states `user` in the arguments, `renderRoute`'s `user` option and the `service` `user` option, so those sections change only where a cross-reference fits: k.services' client method list "`{ params?, query?, body?, signal?, bearer?, user? }`" (5,214).
  - k.shell, after the smoke check of D11 passes on a platform: "Cookies, the caller cookie included (k.security), stay in the shell's cookie store and go only to their origin." gains ", and one with `Max-Age` or `Expires` outlives a relaunch until it expires" (5,872 to about 5,945), naming only the platforms the smoke proved.
  - k.evidence `pii.json` row gains "; `caller` (k.user)" (4,717 to about 4,736).

## Conformance diff
One `rfc:0139` commit by the `conformance-writer`, files headed `Spec: k.user`.

**Identity source** (`packages/server/conformance/identity.test.ts`, `createApp` under a sim ctx with `identity({ identify })` fixtures):
- `identify` answering `'u1'`: a guard, a loader, an action and a live loader's stream of one request each record `user` `'u1'`; the fixture counts one call per request; two requests with the same cookie count two.
- No identity source: `user` is `''` everywhere; `renderRoute(id, { user: 'u1' })` gives its guard and loader `'u1'`, and without the option `''`.
- `identify` is not called for an asset, `/__keel/csp`, a path forwarded to a peer, or a request under `handle.path`.
- Negative (client cannot set `user`): `identify` answering `''`; a request with `x-keel-user: u2`, `?user=u2`, JSON body `{ "user": "u2" }` and cookie `user=u2` records `user` `''` in guard, loader and action.
- Negative (`identify` throws): throwing `new TypeError('t-123')` is 500 `keel.unexpected`, one `diag` whose message names `TypeError` and does not contain `t-123`, and no guard, loader or action is called; answering `42`, or a string of 257 characters, is 500 with `identify returned: invalid`; never settling is 503 `keel.busy` with `data: { limit: 5000 }` once the sim clock passes 5,000 ms.
- Negative (no kernel-written auth cookie): with `identify` and a `handle` whose `fn` answers `set-cookie: sid=abc`, across a GET, a write and an event stream to routes, every `set-cookie` the kernel sets is the caller cookie; the response of `fn` reaches the client with `set-cookie: sid=abc` and k.security's headers.
- `handle`: a same-site POST under `handle.path` reaches `fn` with its body; a cross-site POST (`Sec-Fetch-Site: cross-site`) is 403 `keel.denied` and `fn` is not called; a body over `maxBodyBytes` is 413 and `fn` is not called.

**Across deployables** (`packages/server/conformance/identity-peers.test.ts`, fixture modules `a` and `b` as `{ one: [a, b] }` and `{ x: [a], y: [b] }`, one secret):
- `a`'s loader calls `service({ module: 'b' })` with `user: 'u1'`: `b`'s loader records `'u1'` in both topologies, and `b`'s deployable's `identify` is not called for that request.
- Negative (a forwarded call cannot forge `user`): the `x-keel-user` header captured from that call, sent by a client to `y` after 61 s on the sim clock, or to another path, or with one character of its MAC changed, or signed under another secret, is ignored and `y`'s `identify` answers instead.
- A browser request for a path of `b` sent to `x` is forwarded and `y`'s `identify` sees the request's cookie; `x`'s `identify` is not called.
- `user` on a `service({ module })` call on a ctx no `createApp` with a secret bound is `api.input` at `user`, and nothing is sent.

**Caller lifetime** (`packages/server/conformance/caller-lifetime.test.ts`, `packages/check/conformance/caller-days.test.ts`, `packages/cli/conformance/evidence-caller.test.ts`):
- No option: the minted caller cookie has no `Max-Age`. `caller: { days: 30 }`: `Max-Age=2592000`; a request presenting it gets no new caller cookie.
- E1578 for `{ days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, and `caller` on a `client` deployable; `{ days: 400 }` on `node` is clean.
- `pii.json` of a fixture with `caller: { days: 30 }` has `caller: { days: 30, class: 'network' }`; without, `{ days: null, class: null }`.
- A std.sessions capture of a `tx` with `meta: { caller }` under `caller: { days: 30 }` holds a generated value, not the hash; without the option, the hash.

**Rules** (`packages/check/conformance/identity-source.test.ts`): an `identity.server.ts` with no default export, a default export that is not an `identity(...)` call, `handle.path` `api` (no leading `/`) or `/API`, and `handle.path` `/api` with a route `/api/x` in another deployable are each one E1579 in `keel check` and `keel build`, and `createApp` throws it; `handle.path` `/auth` beside routes under `/app` is clean.

**Per user** (`packages/std-channels/conformance/member-user.test.ts`, `packages/std-sessions/conformance/readers-user.test.ts`, `packages/std-offline/conformance/owner-user.test.ts`): `member` receives the opener's `user` at open and the publisher's at publish; `readers: ['u1']` admits a request whose `user` is `u1` with any caller, and still admits a listed caller hash; a write queued with owner `u1` is accepted by an action passing `writeFor(input.write, user)` with `user` `'u1'`, and refused `offline.owner` with `user` `'u2'`.

## Migration
- `@keel/server`: `identity` export; `createApp({ identity })`; `identify` per routed request with the bound, the error rules and `diag`s; `handle` dispatch before routes; `user` in guard, loader and action args; `x-keel-user` verification under the caller secret (beside `callerSigner.ts`); `caller.days` from the topology (`TopologySchema.ts`, `issueCaller.ts`); `start.ts`, the dev entry and the in-process peers import `identity.server.ts` when it exists; README.
- `@keel/router`: arg types gain `user`. `@keel/testing`: `renderRoute({ user })`. `@keel/services`: client methods take `user?` and sign it through the binding `createApp` makes.
- `@keel/check`: E1578, E1579; `identity.server.ts` read as a project file. `@keel/cli`: `keel build` bundles `identity.server.ts` into each `node` `server.mjs`; evidence `pii.json` `caller`; scaffold: none (an identity source is opt-in).
- `@keel/std-channels` (`member` args), `@keel/std-sessions` (`sessions.reader`, capture of `meta.caller` under `days`), `@keel/std-offline` README (`writeFor(input.write, user)`).
- `@keel/std-credentials`: unchanged by this RFC (Open questions).
- `@keel/std-capacitor`, `@keel/std-tauri`: no code change; the D11 smoke checks are added to the shell smoke list, and the k.shell sentence lands only for the platforms that pass.
- golden-2 `accounts` becomes the example of wiring an identity source. The choice, for the operator to confirm:
  - (a) keep the hand-built sign-in (`credentials(ctx).verify`, the `{ caller, userId }` store) behind an `identify` that reads it, its README marking it an example not to copy for production. No dependency; but the golden app keeps modelling the thing the operator does not want modelled, `identify` must read another module's store from `ctx.storage` (a project file reaching into a module), and the sign-in still dies with the caller cookie, so it shows nothing the seam is for.
  - (b) replace it with the self-hosted session library of Example E1 behind the seam: `identity.server.ts` as in E1; `submitSignIn.server.ts`, `Session.schema.ts`, `Sessions.schema.ts`, `signIn.ts` and the `sessions` store go; the sign-in and sign-up pages post natively to the library's endpoints under `handle.path` through `identity.ts` (Amendment, k.mount); `loadAccount.server.ts`, `loadMe.server.ts` and `postToken.server.ts` read `user`; API tokens stay on `@keel/std-credentials` `mint`/`check`, keyed by `user`. Cost: a third-party dependency and its database adapter in a golden app and its eval workspace, and a library whose API can move; `test/accounts.test.ts` drives sign-in through the library's handler instead of a `tx`.
  - **Recommendation: (b).** The golden app is where the seam is proven against a real library, `handle` and cookie persistence in the shells included; (a) proves nothing about plugging one in and keeps a hand-built sign-in as the model to copy. The build first confirms the library runs under the generated entry with an adapter the golden workspace can use in tests (an in-memory or SQLite one); if it cannot, that is a finding against the seam, and the fallback is (a) for that build.
- golden-1: unchanged (`writeFor(…, "")`, undo by caller). golden-3: keeps its caller-keyed owner and organizers and adds `caller: { days: 400 }` to its `node` deployable.
- Evals, call shape only: `evals/tasks/golden-2/spec-slice.txt` lines 68 and 69 gain `user` in the loader and action args; `evals/tasks/golden-2-catalog/spec-slice.txt` where it lists the same shapes; `evals/tasks/golden-3/TASK.md` the `caller: { days: 400 }` line.
- Docs, at the build:
  - `docs/THREAT-MODEL.md`, a new **Identity** commitment: "Keel authenticates no one. `user` is what the app's `identify` answers, trusted completely: the trust boundary is that function and the library, platform or proxy it calls. Keel guarantees that `user` comes only from `identify` or from an `x-keel-user` assertion another deployable of the app signed under `KEEL_SECRET` (60 s, bound to method, path and search), never from a client value; that writes, `handle` included, pass the same-site check first; that `identify`'s errors are logged by name only; and that the only cookie it sets is the caller cookie. Cookie attributes, lifetime, rotation, fixation defence, revocation and storage of a sign-in are the library's. Limits: an event stream keeps the `user` it opened with until it closes; whoever holds `KEEL_SECRET` can assert any user to every deployable; a captured `x-keel-user` replays to its path for 60 s; a header a proxy injects is only as good as the network that keeps clients from going around the proxy." Caller identity gains the opt-in and its class ("either way not a credential"). Outbox: the owner is the request's `user`. Shells: the D11 facts and that a sign-in cookie sits in the shell's cookie store file, unencrypted by Keel.
  - `docs/GLOSSARY.md`: **identity source** (`identity.server.ts`: the app's `identify` and optional `handle`, through which an auth library or platform tells Keel who the user is) and **user** (the id `identify` answers for a request; distinct from the anonymous `caller`).
  - Skills: `.claude/skills/keel-server/SKILL.md` (`user`, `identity.server.ts`, `handle`, that Keel does not authenticate), `keel-deploy` (`KEEL_SECRET` also signs `x-keel-user`; `caller.days`; a proxy-injected identity needs the deployable reachable only through the proxy), `keel-compliance` (the persistent caller's class and `pii.json`; a user id the app stores is personal data the app marks).

## Build order
1. This RFC, ADR-0161 and k.user (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): the Migration; the Spec diff's sentences; changesets; k.user to `conformance-covered`. The shell smoke checks of D11 run on devices and are recorded as in RFC 0132.

## Token impact
k.user 1,293 (rewritten; was 938). std.signin removed (was 1,233). Map 1,192, unchanged. Each edited section stays at or under 1,500 after the build's sentences.

## Open questions
- **`@keel/std-credentials`.** It is a set of primitives (password `hash`/`verify`, token `mint`/`check`), and an app that composes them into a sign-in system is rolling its own authentication, which this RFC says Keel does not do. This RFC does not change it. Options, for the operator: keep it as documented low-level primitives with a warning that sign-in belongs to a library behind the identity source; move it to example code outside the published packages; deprecate it. golden-2 under recommendation (b) keeps only its API tokens on it.
- **Cross-site POST callbacks.** OIDC `response_mode=form_post` (some providers require it for certain scopes) is a cross-site POST, which the same-site check refuses under `handle` too. Keel could admit an `Origin` listed for `handle` alone; this RFC leaves it out until an app needs it.
- **Hosted platforms' browser widgets.** They need script and connect sources the content security policy refuses; widening the policy is outside this RFC.
- **Shells.** The D11 smoke checks; and OAuth in a shell needs a system browser and a return to the app (an app link or custom scheme), which the shell templates do not configure today.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the caller stays session-only and grants nothing (D1).
- C2: Keel authenticates no one; the app's `identity.server.ts` supplies `identify` and an optional `handle` mount; `user` sits beside `caller` (D2, D4, D5).
- C3: `identify` runs once per routed request before guards, is never cached by the kernel, fails closed (500 on a throw, 503 past 5 s) (D3).
- C4: forwarded requests re-identify at the peer; module calls carry `user` only when the caller passes it, signed under `KEEL_SECRET` for 60 s (D6).
- C5: event streams keep the `user` they opened with (D7).
- C6: outbox owner by `user`; undo by `caller`; channels and readers see both (D8).
- C7: a `node` deployable may opt in to a caller of 1 to 400 days, classed `network`, recorded in `pii.json` (D9).
- C8: shells add nothing for sign-in; the smoke checks decide what k.shell may promise (D11).
- C9: golden-2 adopts a self-hosted session library behind the seam (Migration, recommendation (b)).

## Amendment (pages into `handle`)
Moving golden-2 onto Example E1 found that the built seam cannot be used from a Keel page. Each point was read in the code on 2026-11-18.

**The fault.**
1. A form cannot post to `handle`. `FormProps.action` is an `Href` (`packages/router/src/types/FormProps.ts`), and only `routes.href` mints one (`isHref`, `Href.ts`); inside a router `Form` throws E1505 unless the router's table matches `action` to a route declaring that method (`Form.ts`, `core.accepts`); a route at or under `handle.path` is E1579 (`createApp.ts`, `identityFile.ts`); a plain `<form>` is E1805 (`noIntrinsicElement.ts`).
2. An action cannot carry a library's cookie: it returns `Result<Href | null>`, and a library's server-side sign-in hands back `set-cookie` headers with nowhere to go.
3. Nothing can point into `handle`: `Link to` (`packages/ui/src/elements/Link.ts`), `navigate` and `ok(href)` take an `Href`. And a client router intercepts every same-origin link click that is not an API route (`createRouterWith.ts`, `onClick`) and renders its own 404 for a path its table does not match, so even a correct `href` would not reach the server from a `client` deployable.
4. The one workaround, sign-in pages on a `client` deployable whose browser-run action calls the library through `service({ base })`, makes behaviour depend on placement: the same module on a `node` deployable calls the library from the server, whose `set-cookie` never reaches the browser, so nobody is signed in. That breaks k.topology's promise that placements behave alike, and loses the server-rendered sign-in page.

All four hold. One addition to 3: a server-rendered (`node`) document runs no client router (the resume entry, `packages/compiler/src/entry/resumeEntry.ts`, calls `resume` only), so there a `Form` outside a router already posts natively and validates nothing on the client. The same-site check runs before `handle` (`packages/server/src/internal/handle.ts`, `sameSite.ts`): `Sec-Fetch-Site` `same-origin` or `none`, or the app's own `Origin`, passes; a cross-site POST is 403 before `fn`. The policy has `form-action 'self'` (`packages/server/src/csp/cspPolicy.ts`), for `node` documents and `csp.txt` alike. Every `node` deployable's generated entry imports `identity.server.ts` (`serverEntryCode.ts`), so `handle` is mounted on every `node` origin.

**D4 stands.** Actions still set no response header. The new reason is the fault itself: on a `client` deployable an action runs in the browser and has no HTTP response to put a header on, so header-setting actions would sign people in on one placement and not the other, the fault of point 4. A library's cookie is set where the library answers: in `handle`, on a request the browser itself makes.

**M1. The declaration: `identity.ts`.** A project file beside `topology.ts` default-exports `identityMount('/api/auth')` from `@keel/router`: `{ path, href }`. `identity.server.ts` gives `handle: { path: mount.path, fn }` with `mount` its default import, so the path is written once. `identity.ts` imports only `@keel/router`, so a page on any deployable imports it; importing `identity.server.ts` from client-reachable code is E1004. E1580 ties the two files: an `identity.ts` that is not `identityMount('<literal>')` of lowercase `/` segments, or with no `identity.server.ts` whose `handle.path` is its `path`. So a page cannot make an `Href` into a `handle` the project lacks. The check's E1579 project pass reads `handle.path` as a literal or as that `path`. Alternatives rejected: **a `topology.ts` field** (`topology.ts` imports `@keel/server` and is read statically, never imported by pages; app code would need a generated module to reach it); **reading `handle.path` from `identity.server.ts`** (server-only; E1004); **a generated virtual module** (an import that exists only in the build, a hallucination target, principle 9); **a string in app code** (the thing to avoid: a renamed mount breaks pages silently).

**M2. `href(subpath?, search?)`.** Returns a `MountHref`, an `Href` subtype: `path` + `subpath` + `?` + the string map's keys sorted, each key and value `encodeURIComponent`-encoded, no `?` when empty (k.router's search rule). `subpath` is `''` or `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`. Anything else throws E1582: `//x.example` (protocol-relative once joined), `/..` and `/a/..` (escape `path` after normalisation), `?` and `#` (search and fragment go through `search` or not at all), `%` (an encoded `/` or `.` that Keel's prefix match and the library's router would decode differently), `\` (a separator in some parsers), `:` (a scheme). `path` is lowercase segments and every subpath segment is safe, so the result is root-relative under `path` and same-origin by construction; no `href` can name another origin. `keel check` reports a literal `subpath` that fails. Alternative rejected: **encode any string** (`%2F` and `..` reach the library's router, which may resolve a path Keel did not prefix-match: path confusion between two routers).

**M3. Navigation: a router keeps only its own pages.** A link click, `navigate` and an action's `ok(href)` inside a router stay client-side only for a path its table matches as a page; any other path is a document navigation (`location.assign`, or `location.replace` for `replace`). The initial load and a history pop keep today's behaviour (an unmatched path renders the 404), so a hosted client's unknown URL cannot loop. The router needs no knowledge of `handle.path`: every `Href` matches one of its pages unless it is a `MountHref` or a page another deployable serves, and for both the browser must ask the server. On a server-rendered page the browser already navigates. So a `Link` into `handle` is one GET on every placement. Alternatives rejected: **pass `handle.path` to `createRouter`** (a new option, an entry that must read `identity.ts`, and a link to another deployable's page stays broken); **a second link component for documents** (two ways to link, principle 1).

**M4. Form: native submit after client validation.** A `<Form>` whose `action` no enclosing router matches, or with no router, attaches its own `submit` listener: it validates its `form` handle as a router does (errors shown, submit prevented), else sets `pending()` and lets the browser post. `method` is `'POST'` when `action` is a `MountHref`, by type (`FormProps` generic over its `action`): no hidden `_method` ever goes to a library.
- Enctype: none written, so `application/x-www-form-urlencoded`, as without JS. A file control with a file chosen throws E1583 at submit and sends nothing: urlencoded would send only the name, and a library's auth endpoints take no files (an upload belongs to a Keel action).
- Fields: the form's named controls and the submitter's `name`/`value`, as the browser builds them; Keel adds none. With `Field.bind`, those are the schema's fields.
- Pending: `true` from a submit that proceeds; the page then unloads. `false` again on `pageshow` with `persisted` (a back-forward cache restore), so a restored page is usable.
- The pre-resume queue (k.defaults) composes: a submit before resume is prevented at capture; at replay this listener runs, and an invalid form calls `preventDefault()`, so it is never sent; a valid one does not, so the runtime submits it natively once.
- Personal data: `.pii()` and `s.secret` fields are in the body as typed. The post goes only to the page's own origin (M2), over TLS when that origin is https, and Keel logs no request body. Nothing personal goes in `search`: a URL lands in history and in proxy access logs.
- After the round trip Keel interprets nothing. The app's `fn` answers a form post (`content-type` urlencoded) with a 303: success to a page `Href` carrying the library's `set-cookie`, rejection to the form's page with a search key that route's schema declares (`?error=credentials`), read by the page like any search. `fn` imports the module's `routes` to mint both `Href`s. The page's loader puts neither the email nor the password into a URL; the password field is empty after the round trip (`Field.bind` writes no default for it), and the email field too unless the app keeps it some other way.
- Consequence: a server-rendered page's `Form` to its own route action also validates on the client before its native post, where today it validates only on the server. Same module, same behaviour on every placement.

Alternatives rejected: **a router-made `fetch` to `handle` then `location.assign`** (a same-origin `fetch` would store the cookie, but Keel would then read the library's answer to decide where to go: Keel interpreting an auth response; and it differs from the no-JS post); **a `native` prop on `Form`** (a second mode to choose; the target decides); **multipart when a file is present** (no auth endpoint wants one; refusing is smaller).

**M5. Server, CSRF and the policy.** Nothing changes in `createApp`: a native POST under `handle.path` meets the same-site check first, a cross-site one is 403 and `fn` is not called, and Keel sets no cookie on a `handle` response (`handle` returns before `issueCaller`). `SameSite` on the library's cookie is the library's. `form-action 'self'` admits the post and a same-origin 303. Browsers that apply `form-action` to redirects (Chromium does) block a form post answered by a 302 to another origin, so an OAuth flow starts from a `Link`: a GET document navigation, whose redirect to the provider no directive governs; the provider's callback is a top-level GET, untouched by the same-site check. The policy gains nothing. Alternative rejected: **widen `form-action` to provider origins** (the policy has no option, k.security, and a widened `form-action` lets an injected form post anywhere).

**M6. Origins and split topologies.** `href` is root-relative, so the browser goes to the page's own origin, which must mount `handle`.
- A `node` deployable: mounts it (every `node` entry passes the identity source).
- A `client` deployable with `host`: its pages are served from the host's origin, which mounts it (golden-2: `web` is hosted by `api`).
- A `client` deployable without `host`, or a `static` one: its origin is a static host that mounts nothing; a native post there is a 404 or the host's `index.html`. A `client` deployable with `shells`: its shell build runs from the bundled origin (`capacitor://localhost`, `tauri://localhost`), and a document navigation leaves the app. E1581 reports a module file importing `identity.ts` where such a deployable serves the module (`keel check`, `keel build`), rather than letting `keel dev` (one origin) pass and production sign nobody in. Sign-in inside a shell stays RFC 0139's Open question (a system browser and a return to the app).
- Two `node` deployables on two public origins: each mounts `handle`, but cookies are per origin, so a sign-in on one is not seen by the other's `identify`, and Keel cannot see the deploy's origins to report it. The rule, stated in k.mount: an app serves its pages from one public origin and forwards to its peers (k.topology); `handle` paths are never forwarded (E1579 keeps routes out of them), so the front deployable answers sign-in and the peers identify the forwarded cookie. A library cookie scoped to a parent domain is the library's choice and outside Keel's guarantees. Module calls between deployables carry `user` by the signed header (D6) and need no cookie.
Alternative rejected: **absolute `href`s to the host's origin** (a cross-origin post is refused by the same-site check, and the cookie would land on an origin the page's own requests never reach).

**M7. Testing.** `renderRoute` and `resumeDocument` handles gain `documents()`: the document navigations the page started, in order, `{ method, url, body }`, `body` the urlencoded text of a POST and `null` for a GET. The harness makes none and the page stays as it was, so the next assertion reads it. `fire(id, { type: 'submit' })` runs the form's listener (validation) first, as the browser would. A library's `fn` is tested by the app against `createApp`, as RFC 0139 D10 says. Alternative rejected: **the harness calls `createApp`'s `handle`** (a unit test would run the library).

**Codes.** In E155x beside E1579 (k.mount shares the block; E1569 stays free): E1580 `identity.ts` (M1) · E1581 a module importing `identity.ts` on a deployable whose origin mounts no `handle` (M6) · E1582 a `subpath` `href` refuses (M2; static for a literal, the call throws otherwise) · E1583 a native submit with a file chosen (M4). `explain` entries with the build, each at most 120 tokens.

**What stays impossible.** A form post that ends on another origin (M5). Sign-in from a page whose origin mounts no `handle`: a `static` deployable, a `client` one without `host`, a shell build (M6). One sign-in across two public origins without forwarding (M6). Setting a cookie from an action (D4). A library endpoint that needs a cross-site POST (OIDC `form_post`, Open questions).

**Spec diff (amendment).**
- New section `spec/kernel/k.mount.md`, status proposed: Declaration, Navigation, Form, Server, Origins, Testing, Rules (E1580 to E1583), seven Conformance bullets. 5,216 characters, 1,304 tokens. k.router, k.server, k.security and k.testing sit at 1,495 to 1,499 tokens, so the rules live here.
- `spec/00-map.md`: a `k.mount` row (proposed) after `k.user`, and `k.mount` in the E155x cell; one-line cells trimmed to stay at 1,200 tokens (`k.resume` "regions", `k.ctx` "clock, net", `k.owner` "disposal", `k.scaffold` "edits", `k.api` "JSON", `k.hosting` "`host`", `k.openapi` "clients").
- k.user unchanged: its bullets and Rules stay true (`handle.path` is still a path of lowercase segments).
- Prose replacements for the conformance commit, each in a conformance-covered section (5,996 characters before, 5,997 after):
  - k.router Client: "Same-origin link clicks inside a router navigate client-side." to "Same-origin link clicks inside a router navigate client-side when its table has the page (k.mount)."; ", as from the server." to "."; "else the only one mounted; with none or several, nothing." to "else the only one mounted; else nothing.".
  - The doc comments of `Href.ts` ("Only `routes.href()` mints one") and `Form.ts` change with the build.

**Conformance (amendment).** One `rfc:0139` commit by the `conformance-writer`, files headed `Spec: k.mount`, fixtures with `identity.ts` `identityMount('/api/auth')` and an `identity.server.ts` using `mount.path`:
- `packages/router/conformance/mount-href.test.ts`: `href('/sign-in/email', { b: '2', a: 'x y' })` is `/api/auth/sign-in/email?a=x%20y&b=2`; `href()` is `/api/auth`; `href('', {})` has no `?`; for generated safe subpaths the result starts with `/api/auth/` or equals `/api/auth`, never `//`. Negatives, each throwing E1582: `'//x.example'`, `'/../x'`, `'/a/..'`, `'/a/./b'`, `'/a//b'`, `'a'` (no leading `/`), `'/a?b'`, `'/a#b'`, `'/a%2f'`, `'/a\\b'`, `'https://x'`, `'/a:b'`. A `MountHref` passes to `Link to`, `navigate` and `ok()` and type-checks; `<Form method="PUT" action={mount.href('/x')}>` is a type error and `method="POST"` is not.
- `packages/router/conformance/mount-navigation.test.ts` (`renderRoute`): a `Link` to `mount.href('/login/github')` clicked, `navigate(mount.href('/x'))` and an action returning `ok(mount.href('/x'))` each add one `{ method: 'GET', url, body: null }` to `documents()`, leave `route().id` and the page's nodes unchanged, and run no loader; a `Link` to a `routes.href` page navigates client-side and adds nothing; `navigate` to a page of another deployable's manifest adds one GET. A router started at an unmatched URL renders the 404 and adds nothing.
- `packages/router/conformance/mount-form.test.ts` (`renderRoute`, a sign-in page whose `form(Credentials)` has `email` and `password`, `password` `s.secret`, `email` `.pii('contact')`): with an empty email, `fire` submit shows the field error, `documents()` stays empty and `pending()` stays `false`; valid, one entry `{ method: 'POST', url: '/api/auth/sign-in/email', body: 'email=a%40b.example&password=pw' }` (exactly the two named fields, no `_method`, no other added field), `pending()` `true`; a `pageshow` with `persisted` makes it `false`. A submitter button with `name` adds its pair. A form holding a file control with a file chosen: submit throws E1583, nothing recorded. Inside a router, a `Form` whose action route lacks the method still throws E1505.
- `packages/server/conformance/mount-placement.test.ts`: one page module (that sign-in page) under `renderRoute` (client router) and served by `createApp` on a `node` fixture then `resumeDocument`: the same invalid and valid inputs give equal `documents()` (empty, then the one POST). A submit dispatched before `resume` on the valid form is sent once after `resume` (one entry, no second `submit` event); on the invalid form, never, with the error shown.
- `packages/server/conformance/mount-server.test.ts` (`createApp`, sim ctx): a POST `application/x-www-form-urlencoded` under `/api/auth` with `Sec-Fetch-Site: same-origin` reaches `fn` with the body as sent; `fn` answering 303 with `set-cookie: sid=abc` reaches the client unchanged plus k.security's headers. Negatives: the same POST with `Sec-Fetch-Site: cross-site` and a foreign `Origin` is 403 `keel.denied` and `fn` is not called; across a document GET, an action POST and that mount POST, no `set-cookie` other than `fn`'s and the caller cookie appears, and the mount response carries no caller cookie. A production document's policy still has `form-action 'self'` and no other `form-action` source.
- `packages/check/conformance/mount-rules.test.ts`: E1580 for `identity.ts` exporting `identityMount(p)` with `p` a variable, `identityMount('/API')`, an `identity.ts` with no `identity.server.ts`, and one whose `identity.server.ts` `handle.path` is the literal `'/api/auth'`; clean with `mount.path`. A route `/api/auth/x` with the path declared only in `identity.ts` is E1579. E1581 for a module file importing `identity.ts` served by a `static` deployable, by a `client` deployable without `host`, and by a `client` deployable with `host` and `shells`; clean on a `node` deployable and on a `client` one with `host` and no `shells`. E1582 for `mount.href('/a/..')` and `mount.href('//x')` in a module file; `mount.href('/sign-in/email')` and a non-literal subpath are clean. Each in `keel check` and `keel build`.

**Migration (amendment).**
- `@keel/router`: `identityMount`, `MountHref`; the router leaves for a path its table does not match (link click, `navigate`, `ok`); `Form` native submit with validation, pending, E1583, and the `method` type; `Href.ts`'s comment.
- `@keel/testing`: `documents()` on route and `resumeDocument` handles; the harness stubs native submit and `location` navigation to record them.
- `@keel/check`, `@keel/compiler`: E1580 to E1582 (`identitySource` reads `handle.path` as a literal or `identity.ts`'s `path`; the project pass of E1579 uses it); `explain` entries; `identity.ts` read as a project file.
- `@keel/server`: none.
- golden-2 `accounts` (RFC 0139 recommendation (b)): `identity.ts` beside `topology.ts`; `identity.server.ts` as in Example E1, its `fn` turning the library's form-post answers into 303s; `SigninPage.tsx` and `SignupPage.tsx` keep `form(Credentials)` and post to `mount.href('/sign-in/email')` and `mount.href('/sign-up/email')`, their routes declaring `search: { error? }` and the actions `submitSignIn.server.ts` and `submitSignUp.server.ts` removed; a sign-out `Form` posts to `mount.href('/sign-out')`. Every accounts page is on `api` (`node`), so E1581 is clean; `web` imports nothing from `identity.ts`. `test/accounts.test.ts` asserts the `documents()` entries and drives the library through `createApp`.
- `docs/THREAT-MODEL.md`, the Identity commitment of RFC 0139 Migration gains: "Pages reach `handle` only by a same-origin `href` under `handle.path` (no `href` names another origin or escapes the path); a page's form posts there natively and passes the same-site check; Keel reads no answer of `fn` and sets no cookie on it. Limits: a form post may not end on another origin (`form-action 'self'`), so OAuth starts from a link; cookies are per origin, so an app with two public origins has two sign-ins; a shell build cannot reach `handle` by navigation."
- `docs/GLOSSARY.md`: **identity source** gains "and `identity.ts`, its `identityMount(path)` half that pages import".
- Skills: `keel-server` (`identity.ts`, `mount.href`, the `fn` glue that turns a library's JSON answer into a 303, E1580 to E1583); `keel-forms` (a `Form` to a `MountHref` posts natively after validation; POST only; no files; a rejection comes back as a search key the route declares).

**Build order (amendment).** 1: this amendment, k.mount and the map (commit 1). 2: the conformance above, red, with the k.router replacement. 3: the Migration; k.mount to `conformance-covered`.

**Choices (amendment)**, for the orchestrator to confirm or reverse:
- A1: `identity.ts` with `identityMount(path)` is the one declaration pages and `identity.server.ts` share (M1).
- A2: `href` takes a closed-charset subpath and a string search map; anything else throws E1582 (M2).
- A3: a router keeps client-side only the pages its table matches; other links, `navigate` and `ok` load a document (M3).
- A4: a `Form` no router intercepts validates, then posts natively, urlencoded, POST only to a `MountHref`, no files (M4).
- A5: D4 stands; nothing changes in `createApp` or the policy (M5).
- A6: E1581 for modules on deployables whose origin mounts no `handle`; one public origin per app is a stated rule, not a check (M6).
- A7: `documents()` records, never performs, a document navigation in the harness (M7).
