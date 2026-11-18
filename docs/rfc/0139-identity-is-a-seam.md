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
`handle: { path, fn }`: a request at `path` or under it goes to `fn(request, ctx)`, the full `Request` with its body capped at `maxBodyBytes`; the `Response` `fn` returns, `set-cookie` included, is sent with k.security's headers added. A write there passes the same-site check first. A route of any deployable at or under `path`, or a `path` not of lowercase `/` segments, is E1579. Every library surveyed below needs endpoints that set its own cookies (sign-in, OAuth callback, sign-out); without a mount only header-borne identities would fit. Alternatives rejected: **actions that set response headers** (every action would gain cookie control, and the action `Result` shape would change for all apps); **no mount** (excludes session libraries and OIDC clients); **exempting `handle` from the same-site check** (would let a cross-site form reach a library endpoint; the OIDC `form_post` case is an Open question).

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

**E1. A self-hosted session library for Node** (Better Auth). Needs from a host: a mount for its Web `Request` to `Response` handler at a base path (default `/api/auth`), which sets and clears its own session cookie, and a way to read the session from the request's headers (`auth.api.getSession({ headers })`, `null` when signed out). Keeps users and sessions in its own database through its adapter, not `ctx.storage`.
```ts
// identity.server.ts
export default identity({
  identify: async ({ request }) => (await auth.api.getSession({ headers: request.headers }))?.user.id ?? '',
  handle: { path: '/api/auth', fn: (request) => auth.handler(request) },
})
```
Auth.js core (`Auth(request, config)` returns a `Response`; its session is a GET of its session action with the request's cookie; base path `/auth` outside Next.js) fits the same way.

**E2. An OAuth/OIDC client library** (openid-client 6: `discovery`, `randomPKCECodeVerifier`, `calculatePKCECodeChallenge`, `buildAuthorizationUrl`, `authorizationCodeGrant`). Needs: a login endpoint that keeps a PKCE verifier and `state` in a short-lived `SameSite=Lax` cookie and redirects to the provider; a callback endpoint at the registered redirect URI that reads the query and that cookie and exchanges the code; then a session of its own, which the library does not keep (pair it with E1 or a signed cookie from a session library). Both endpoints live in `handle`; the callback is a top-level GET, which the same-site check does not touch.

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
  - (b) replace it with the self-hosted session library of Example E1 behind the seam: `identity.server.ts` as in E1; `submitSignIn.server.ts`, `Session.schema.ts`, `Sessions.schema.ts`, `signIn.ts` and the `sessions` store go; the sign-in and sign-up pages post to the library's endpoints under `handle.path`; `loadAccount.server.ts`, `loadMe.server.ts` and `postToken.server.ts` read `user`; API tokens stay on `@keel/std-credentials` `mint`/`check`, keyed by `user`. Cost: a third-party dependency and its database adapter in a golden app and its eval workspace, and a library whose API can move; `test/accounts.test.ts` drives sign-in through the library's handler instead of a `tx`.
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
