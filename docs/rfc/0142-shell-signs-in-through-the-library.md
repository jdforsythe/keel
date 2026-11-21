# RFC 0142: a shell signs in through the app's auth library

Status: accepted (ADR-0164) by the orchestrator on the operator's leave to go ahead on its recommendation (2026-11-19), for the operator to confirm.

## Problem
A page in a native shell cannot use the identity mount. Each point was read in the code and spec on 2026-11-18.

1. A shell build's pages load from the bundled origin (`capacitor://localhost`, `https://localhost`, `tauri://localhost`, k.shell); the identity source's `handle` lives on a `node` deployable at `KEEL_ORIGIN`. A `MountHref` is root-relative (k.mount), so a `Link` or native `Form` post to it is a document navigation on the bundled origin: it leaves the app for a file that does not exist. k.mount's E1581 therefore refuses a module that imports `identity.ts` where a `client` deployable with `shells` serves it, and RFC 0139 left shell sign-in as an Open question ("a system browser and a return to the app").
2. Requests a shell page makes through `ctx.net` already reach `KEEL_ORIGIN` with cookies: the drivers (`capacitorNet.ts` with `KeelHttpPlugin.java`/`.swift`, `tauriNet.ts` over `@tauri-apps/plugin-http` 2.9.0) map a page-origin URL to `KEEL_ORIGIN` and send it through the native HTTP client, whose cookie store keeps every `set-cookie` (Android: the WebView `CookieManager` through `CapacitorCookieManager`; iOS: `HTTPCookieStorage.shared`; Tauri: the plugin's reqwest jar, saved to `.cookies`) and sends it to its origin only. `set-cookie` never reaches the page. The caller cookie travels this way today (RFC 0139 D11).
3. The same-site check (`packages/server/src/internal/sameSite.ts`) passes a write with `Sec-Fetch-Site` `same-origin`/`none`, the app's own `Origin`, `x-keel: 1` with `accept: application/json`, or neither header. Android and iOS native requests carry neither; tauri-plugin-http 2.9.0 adds `Origin: tauri://localhost` (`commands.rs`, without its `unsafe-headers` feature), so a Tauri form post without `x-keel` is 403.
4. All three native clients follow redirects by default (`HttpURLConnection.instanceFollowRedirects`, `URLSession`, the plugin's `DEFAULT_MAX_REDIRECTIONS` 10); tauri-plugin-http takes `maxRedirections: 0` for none.
5. Outbox entries carry their owner (std.offline Owner). When a sign-in expires the page's owner becomes `""` and every queued entry of the user is stored `failed` with `offline.owner`, never posted again; a drain racing the expiry gets `offline.owner` from `writeFor` and fails the same way. A shell that stays offline past the library's session lifetime loses its queued writes.

The binding direction: Keel is not an authentication library. It mints, stores, rotates and verifies no sign-in credential and sets no sign-in cookie; identity is a seam an app plugs an established library or platform into (golden-2 uses Better Auth, RFC 0139 Migration).

## Proposal
One new section, `k.return` (Mount from a shell), status proposed, and an appended paragraph in std.outbox-owner.

### D1. The library's cookie lives where the caller cookie lives
In a shell, every request to `KEEL_ORIGIN` already goes through one native cookie store that the page cannot read. A sign-in that answers through that store needs no new place for a credential: the library sets its cookie on a response, the platform's store keeps it, and the next `net` request carries it to the same origin, where the app's `identify` reads it as on the web. Keel's code handles no cookie value: the drivers pass requests to platform HTTP clients and strip `set-cookie` from what the page sees, as they do today.

### D2. Mount requests: a document navigation to a `MountHref` goes through `net`
In a ctx of `mode: 'shell'`, each document navigation k.mount names (a `Link` click, `navigate`, an action's `ok(href)`, a `Form` with no matching router) whose target is a `MountHref` becomes a request through `ctx.net`, the `href` unchanged (the driver maps it to `KEEL_ORIGIN`). A GET for the first three; for a `Form`, after the same validation, a POST of the urlencoded body a browser would send (named controls and the submitter's), `pending()` `true` until the answer. Each carries `x-keel: 1` and `accept: application/json`, the headers every Keel `net` write to its own server already carries, so the same-site check passes on all three platforms (Problem 3) without k.server changing; and `redirect: 'manual'`.
- The drivers honour `redirect: 'manual'`: Android `setInstanceFollowRedirects(false)`, iOS a task delegate that refuses the redirect, Tauri `maxRedirections: 0`. The 3xx resolves as it came, `set-cookie` stored by the native store and stripped from the page's copy.
- Keel reads the status and `location` and nothing else, as a browser follows a 303: a page the router matches is a client-side navigation; another path under `handle.path` is the next mount request GET, at most 5 in a row (a loop guard); any other URL (a provider, a page another deployable serves) opens in the external browser. A GET answered without a redirect opens its own URL on `KEEL_ORIGIN` in the external browser (a library's hosted sign-in page); a POST answered without one leaves the page and sets `pending()` `false`, since a POST cannot be replayed in another browser.
- k.mount's contract for `fn` is unchanged: a form post is answered with a 303 to a page `Href` carrying the library's `set-cookie`, a rejection with a 303 to the form's page and a declared search key. The same `fn` serves browser and shell.
- The shell entry imports `identity.ts` when the project has one, so the runtime knows `handle.path`; nothing else in the build reads it.

Why this reading of a redirect is not Keel interpreting an auth response: RFC 0139's k.mount amendment rejected a router-made `fetch` followed by `location.assign` on the web because a browser can do the post itself and Keel would add a second behaviour beside the no-JS one. A shell has no browser to do the post and no no-JS mode. Keel acts as the user agent and does what a browser does with a 3xx; it never reads a body, a cookie or a token.

Alternatives rejected:
- **The webview navigates to the API origin's sign-in page and back.** The webview's cookie store is not the native one on iOS (`WKHTTPCookieStore` versus `HTTPCookieStorage.shared`) or Tauri (the webview's store versus the reqwest jar), so the cookie it receives is not sent by `net`; only Android shares one store. A remote page inside the shell's webview is given the native bridge if the shell allows the navigation (Capacitor `server.allowNavigation`), so any script on that origin reaches native plugins. Google and other providers refuse OAuth in an embedded webview. Returning to the bundled origin reloads the app.
- **The library's bearer mode, the token in the shell's secure-storage plugin, attached by Keel.** Keel's `net` would read a credential from storage and attach it to every request: Keel storing and sending a sign-in credential, which the direction forbids. The token is also readable by page script, where the native cookie is not. An app may still do this itself: a token it keeps in its own plugin goes on its own requests as `bearer` (k.services), and the shells pass `authorization` unchanged (RFC 0139 D11). Keel adds no slot.
- **Absolute `href`s to `KEEL_ORIGIN` in shell builds.** An `Href` would differ by build, and a document navigation to it still leaves the webview for a remote origin (the first alternative's faults).
- **A `fetch` from page script with `credentials: 'include'`.** A cross-origin request from `capacitor://localhost` needs CORS with credentials from the API, third-party cookie rules apply in WKWebView, and it bypasses the native store the rest of `net` uses.

### D3. The external browser and return links
OAuth and OIDC providers expect an external user agent for native apps (RFC 8252): a browser the app cannot script, whose address bar the person sees. Keel opens a URL there only from D2's redirect rules: Custom Tabs on Android and an in-app Safari view on iOS (`@capacitor/browser`), the default browser on desktop (`tauri-plugin-opener`). It shares no cookie with the app.

The return is a private-use URI scheme named by the shell's `id`, which k.shell already requires to be reverse-DNS, the form RFC 8252 §7.1 recommends: `dev.keel.golden2:/api/auth/callback/github?code=…&state=…`. The generated shell files register it (Android intent filter, iOS `CFBundleURLTypes`, Tauri `plugins.deep-link.desktop.schemes`). A return link received at launch or while running (`@capacitor/app` `appUrlOpen` and `getLaunchUrl`; `tauri-plugin-deep-link`, with `tauri-plugin-single-instance` so a second launch on Linux and Windows hands its link to the running app) closes the in-app Safari view and is read as a redirect target on `KEEL_ORIGIN`: under `handle.path`, a mount request GET; a page, a navigation; anything else is ignored. Keel adds nothing to it.

So an OAuth flow runs through the library's own endpoints: the start (a `Link` to `mount.href('/login/github')`) is a mount request whose 302 to the provider sets the library's PKCE verifier and `state` cookie in the native store and opens the provider in the external browser; the provider returns to `<id>:/api/auth/callback/github`; that GET carries the verifier cookie from the native store, the library exchanges the code and sets its session there, and its 303 to a page lands in the app. A code intercepted by another app that registered the same scheme is useless without the verifier, which never left the native store. A provider that accepts only https redirect URIs runs the whole flow in the external browser and hands the app a one-time code through a return link, exchanged by a mount request; that code, its lifetime and its binding are the library's.

Alternatives rejected:
- **Claimed https links (Android App Links, iOS Universal Links) as the return.** Stronger: no other app can claim the URL. They need `assetlinks.json` and `apple-app-site-association` on `KEEL_ORIGIN` naming the signing certificate and team id, and signing is not Keel's (k.shell). Runner-up; an app can add them, and Keel would read such a link by the same rule once a later RFC registers the host.
- **A scheme the app names in `topology.ts`.** A second identifier to keep unique; the reverse-DNS `id` is unique already.
- **`ASWebAuthenticationSession` on iOS.** Apple's session API returns the callback without registering a scheme and shares Safari's cookies, so a sign-in in Safari would carry over. It needs native code in `KeelHttpPlugin.swift` and differs from Android's path; `@capacitor/browser` keeps one plugin for both. Recorded for the build to revisit if a provider requires it.

### D4. `mount.href` in a shell
Unchanged: the same root-relative `MountHref`. D2 decides what a navigation to it does; the `net` driver decides where it goes. One `href` for every placement.

### D5. E1581
E1581 drops "or with `shells`": a `client` deployable with `host` and `shells` mounts `handle` on its host's origin for the browser build, and its shell build reaches the same origin through `net`, since a shell build's `KEEL_ORIGIN` must be that origin (stated in k.return; a deploy setting the check cannot see). A `static` deployable and a `client` one without `host` still trigger it.

### D6. Sign-out
A `Form` POST to the library's sign-out path, a mount request: the library's expiring `set-cookie` clears the native store and its 303 lands on a page. Open event streams close on navigation (k.user). A session the external browser holds (the https-only provider path of D3) stays there; whether the library also revokes it is the library's.

### D7. The outbox when the user is no one
- `writeFor(write, "")` with a named `write.owner` answers `offline.signin` (400) instead of `offline.owner`: the request has no user, not another one.
- A flush reading `offline.signin` keeps the entry `queued` and stops flushing until `drain` or `send` is given that owner again.
- Giving `""` as the owner holds other owners' entries `queued`; only another named owner fails them, as today.
So an expired sign-in or a sign-out keeps the user's queued writes on the device until that user signs in again, and they are then sent once with their keys (k.sync). Their bodies stay in `ctx.storage` meanwhile, as `failed` entries' bodies do today. This holds on the web too; a shell is where it bites, offline for days. Alternatives rejected: **keep failing them** (a session lifetime silently deletes a person's writes); **send them under `""`** (writes committed under no owner); **a guard answering 403 for no user** (std.offline fails every other status, and the guard cannot tell the outbox to wait).

### D8. Whose job
- Keel: mount requests through `net` with manual redirects; the external browser; the scheme registration and return-link intake; the outbox pause. It reads a status and a `location`, never a body, cookie or token.
- The platform: the native cookie store that keeps the library's cookie, as it keeps the caller cookie.
- The library and the app: the cookie or token, its lifetime, rotation and revocation; PKCE and `state`; the redirect URIs registered with each provider and the library's trust in `<id>:/` returns; a one-time code if a provider forces the flow into the external browser; any bearer token kept in a plugin of the app's choosing.

## Known limits
Each needs a device and is not asserted by conformance:
- That each native store keeps a cookie set on a manual 3xx and sends it on the next request (Android `HttpURLConnection` hands each response to `CookieHandler`; iOS stores a refused redirect's cookies; reqwest stores per response). Checked by the shell smoke, with RFC 0139 D11's relaunch checks: a cookie with `Max-Age` outlives a force-stop, an iOS reboot, a Tauri crash.
- That a return link reaches a cold-started app and a running one on each platform, and that the in-app Safari view closes.
- Desktop schemes register only from an installed bundle (macOS Launch Services, a Linux `.desktop` file, the Windows registry); `keel build --target tauri` builds with `--no-bundle`, so its debug artifact does not receive return links. A bundled build does.
- Which providers accept a private-use scheme redirect URI for the app's client type.
- Another app may register the same scheme on Android and desktop; a return must carry nothing the library has not bound to the native store (PKCE, or a one-time code bound to a verifier).

## Spec diff
- New `spec/kernel/k.return.md`, status proposed: intro, Mount requests, External browser, Return links, Sign-out, The app's part, Testing, Limits, Rules (none), five Conformance bullets. 4,544 characters, 1,136 tokens.
- `spec/00-map.md`: a `k.return` row (proposed) after `k.mount`. One-line cells trimmed to make room: `k.component` "props", `k.ui` "CSS", `k.host` "zone", `k.store` "log", `k.security` "CSP", `k.guards` "deny", `k.forms` "fields", `k.cli` "flags", `k.a11y` "WCAG", `k.model` "traces". 4,799 to 4,796 characters, 1,199.75 to 1,199 tokens.
- `spec/std/std.outbox-owner.md` (proposed): a **Signed out** paragraph before Rules and one Conformance bullet, appended. 2,403 to 3,311 characters, 828 tokens.
- For the conformance commit, each quoted or in a conformance-covered section:
  - k.mount Rules, quoted by `packages/check/conformance/mount-rules.test.ts` and `packages/cli/conformance/mount-rules-build.test.ts`: "or a `client` one without `host` or with `shells`, serves the module" to "or a `client` one without `host`, serves the module" (5,230 to 5,213 characters); both headers re-quote it.
  - std.outbox-owner Conformance bullet 1, quoted by `packages/std-offline/conformance/owner-check.test.ts`: "with owner `'b'` or `\"\"` it is `err`" to "with owner `'b'` it is `err`"; that header re-quotes it. When: "A sign-in or sign-out in another tab before then refuses the write" to "A sign-in as another user in another tab before then refuses the write; a sign-out pauses it (Signed out)".
  - std.offline Owner (conformance-covered, not quoted): "When it changes, and on load, each other owner's entry not `failed` is stored `failed` with `offline.owner`" gains ", unless the owner given is `\"\"`, which holds them `queued` (std.outbox-owner)"; "Any other status: `failed` with its `ApiError`" gains "; `offline.signin`: std.outbox-owner". 5,874 to about 5,960.
- For the build commit (sentences describing code it replaces, k.shell proposed): Files: `Cargo.toml` gains `tauri-plugin-deep-link`, `tauri-plugin-opener`, `tauri-plugin-single-instance`; `tauri.conf.json` gains the deep-link scheme; `capacitor.config.json` unchanged, the Android manifest and iOS `Info.plist` gain the scheme; the shell ctx's `net.fetch` bullet gains "honouring `redirect: 'manual'`". 5,874 to about 5,990.
- Codes: none new. `offline.signin` is a result code of `@keel/std-offline`.

## Conformance diff
One `rfc:0142` commit by the `conformance-writer`, red:
- `packages/router/conformance/return-mount-requests.test.ts` (`renderRoute(id, { shell: true })`, sim `net` routes): the first three k.return bullets: a valid `Form` POST, its headers, body and `redirect`; the 303 to a page; a `Link` whose 302 to another origin is one external GET in `documents()`; a 302 under the mount is a second `net` GET; six in a row stop at five; an invalid `Form` sends nothing; `returnLink` under the mount, to a page, and elsewhere.
- `packages/std-capacitor/conformance/manual-redirect.test.ts` and `packages/std-tauri/conformance/manual-redirect.test.ts`: the fourth bullet against each package's native fakes.
- `packages/scaffold/conformance/return-scheme.test.ts`: the fifth bullet, for golden-like `id`s.
- `packages/std-offline/conformance/owner-signin.test.ts`: the appended std.outbox-owner bullet; and the changed `owner-check.test.ts` bullet 1 (`""` no longer `offline.owner`).
- The re-quoted k.mount Rules headers; `mount-rules.test.ts` and `mount-rules-build.test.ts` move the `client` with `host` and `shells` fixture from triggering to clean.

## Migration
- `@keel/router`: in a ctx of `mode: 'shell'`, `Link`, `navigate`, `ok` and `Form` send a `MountHref` through `net` (D2); the redirect rules; return-link intake through a shell capability.
- `@keel/testing`: `renderRoute(id, { shell: true })`; `returnLink(url)` on its handle; `documents()` records external opens.
- `@keel/std-capacitor`: `redirect: 'manual'` in `KeelHttpPlugin.java` and `.swift`; external open with `@capacitor/browser`, return links with `@capacitor/app` (both pinned, in the app's `dependencies` beside it).
- `@keel/std-tauri`: `maxRedirections: 0` for manual; `tauri-plugin-opener`, `tauri-plugin-deep-link`, `tauri-plugin-single-instance` and their JS bindings.
- `@keel/scaffold`, `@keel/cli`: the scheme in the generated files; the Tauri capability grants opener and deep-link; the shell entry imports `identity.ts` when present.
- `@keel/check`, `@keel/compiler`: E1581 without `shells`.
- `@keel/std-offline`: `writeFor`'s `offline.signin`; the flush pause; `""` holds.
- golden-1 (the app with `shells`) imports no `identity.ts` and changes nothing. golden-2 has no shell; adding one is the app's choice and outside this RFC.
- Docs: `docs/THREAT-MODEL.md` Identity gains: "In a shell, the library's cookie is kept by the platform's native cookie store and sent by `net` to `KEEL_ORIGIN` only; Keel reads a mount answer's status and `location` only. Return links use a private-use scheme any app can claim on Android and desktop, so a return must carry nothing usable without the native store." Skills: `keel-server` and `keel-storage` (shell sign-in, return links), `keel-writes` (`offline.signin`). Changesets for each package above.

## Build order
1. This RFC, ADR-0164, k.return, std.outbox-owner and the map (commit 1).
2. `conformance-writer`: the Conformance diff and the re-quotes, red (commit 2).
3. Builders: the Migration and the k.shell sentences; k.return and std.outbox-owner to `implemented`, then `conformance-covered` when green. The Known limits run on devices in the shell smoke, as RFC 0132's checks do.

## Token impact
k.return 1,136 (new). std.outbox-owner 828 (was 601). Map 1,199 (was 1,199.75). k.mount 1,304 after the conformance commit; std.offline about 1,490; k.shell about 1,498 after the build.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the library's cookie lives in the shell's native cookie store, as the caller cookie does; Keel adds no credential slot (D1). Runner-up: an app-held bearer token, which stays possible without Keel (D2).
- C2: a navigation to a `MountHref` in a shell is a `net` request with manual redirects; Keel reads status and `location` only (D2). Runner-up: none viable; the webview navigation fails on iOS and Tauri.
- C3: OAuth uses the external browser and a return link on the `id` scheme, the code exchanged by the library's own callback through `net` (D3). Runner-up: claimed https links, when signing is the app's.
- C4: `mount.href` is unchanged in a shell (D4).
- C5: E1581 no longer fires for `shells` (D5).
- C6: sign-out is the same mount `Form` (D6).
- C7: an outbox paused by `offline.signin` and an owner of `""` holds its entries (D7). Runner-up: a separate `offline.paused` state visible to pages; left out until a page needs to tell paused from queued.

## Open questions
- Whether the shell smoke (RFC 0132) runs on a device in CI or by hand per release; no paid macOS runner (iOS stays manual).
- `@keel/std-capacitor` and `@keel/std-tauri` gain native dependencies an app without identity does not use. Gate them on the presence of `identity.ts`, or always ship them? The build decides by size; recorded here for the operator.
