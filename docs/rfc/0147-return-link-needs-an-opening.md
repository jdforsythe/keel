# RFC 0147: a return link needs an opening

Status: draft, for the orchestrator to accept (ADR-0169). Amends RFC 0142 D3.

## Problem
A shell registers its `id` as a URI scheme (k.return). Any app on the device, and any web page through a link, can open `<id>:/<path>?<search>`. The shell reads every such link as a redirect: a path under `handle.path` becomes a mount request GET carrying the native cookie store's cookies and `x-keel: 1`, which passes the same-site check (k.server). An auth library that changes state on a GET under its mount (a GET sign-out, a GET that links an account or accepts an invitation) is therefore reachable from outside the app, with the person's session, without the person doing anything in the app. PKCE protects the code exchange, not other GET endpoints of the library.

## Proposal

### D1. An opening
Each time a mount request the page starts (a `Link` click, `navigate`, `ok(href)`, a `Form`), or a redirect Keel follows after it, opens the external browser (a redirect to another origin, a redirect on `KEEL_ORIGIN` that is neither a page nor under the mount, or a GET answered without a redirect), one opening is pending. It is kept in `ctx.storage` under `keel.return` with a deadline of `ctx.clock.now()` plus 600000 ms. A new opening replaces the pending one: at most one is pending.

A request chain that a return link starts (the GET of a link that took an opening, and each redirect after it) records no opening, whatever it opens: the external browser still opens where the redirect rules say, but no return link is admitted from it. Otherwise one admitted link could re-arm the gate: its GET answered 404, or redirected to an outside URL, or to a path on `KEEL_ORIGIN` that is neither a page nor under the mount, would record a fresh opening, and a sender could repeat that without end.

A stored value that is malformed, or whose deadline is more than 600000 ms after `ctx.clock.now()`, is no opening. When the opening cannot be stored, the external browser still opens and that opening admits no link.

### D2. A return link takes the opening
A return link the app receives, at launch or while running, first takes the pending opening in one `commit` that expects the stored value, so two links racing for one opening cannot both win. With none pending, or once `ctx.clock.now()` reaches the deadline, the link is ignored: no request, no navigation, the in-app Safari view left as it is. A link that took the opening closes the in-app Safari view and is read as today: a mount request GET under `handle.path`, a navigation to a page, nothing otherwise. Links that are not `<id>:/<path>?<search>` take nothing.

### D3. A mount answer to the shell's own scheme
A mount answer that redirects to `<id>:/<path>` is the server's answer to a request the shell made, not a link from outside. It is read as a return link that takes no opening, and it continues the chain it answers: its GET counts toward the "at most 5 in a row" limit instead of starting a new row, and the chain keeps its start for D1 (a chain a return link started stays one). Without this, a server answering each GET with a redirect to `<id>:/<path>` loops without end.

### D4. Where it lives
In `@keel/router`'s shell intake (`mountRequests`), used by both `@keel/std-capacitor` and `@keel/std-tauri` `shellMount`; app code does nothing. Both shells behave the same.

## Alternatives
Each is a judgment call for the orchestrator to confirm or reverse.
- **Scope: every return link, not only those under the mount.** A link to a page sends no mount request, so it is not the hole. Gating it too keeps one rule for the intake, one conformance shape, and leaves no unguarded path into the app from outside while a sign-in is in progress. Chosen. Runner-up: gate only mount paths, which keeps deep links to pages open but splits the rule.
- **Which openings count: every external open a mount request makes**, not only redirects to another origin. A library's hosted page on `KEEL_ORIGIN` (a GET answered without a redirect) is a sign-in that may return through a link, the https-only provider path of RFC 0142 D3. Every external open in a shell comes from a mount request, so this is all of them.
- **Survives a relaunch: yes.** Android and iOS kill a backgrounded app under memory pressure while the person is in the provider's pages; a cold start would then refuse the real return and the sign-in fails with no message. Keeping the opening in `ctx.storage` adds no reach for an attacker: the value is written only by the shell's own open, bounded by the deadline, and taken once. Rejected: memory only, which is simpler and closes the hole the same, at the cost of failed sign-ins on low-memory devices.
- **Lifetime: 600000 ms, fixed.** Bounds an abandoned sign-in's window. OAuth authorization codes are meant to be short-lived (RFC 6749 §4.1.2 recommends at most 10 minutes), so a return later than that fails at the library anyway. Not configurable: one value, no topology field. Runner-up: no lifetime (an abandoned sign-in leaves the window open until the next link).
- **A second opening replaces the first.** The person retried; one browser flow is live. With one pending value a link from the first browser can still take it, so this does not tell the two apart; it only keeps the count at one. Rejected: a set of openings (widens the window per retry).
- **No binding value.** A one-time value the shell adds to the opened URL and expects back would mean Keel writing into the provider's or library's URL and reading the return's query, which RFC 0142 D2 rules out (Keel reads a status and `location` only), and the provider builds the return from its registered redirect URI, which carries no such value unless the library echoes it. The library's `state` already binds a return to its own flow. The pending flag, once, with a deadline closes the hole as stated: a link with no sign-in in progress does nothing. Residual risk below.
- **Refused links are ignored, no diagnostic.** k.return already ignores links it cannot read and prints nothing; a forged link is attacker-driven, and logging each gives the developer nothing to act on. No new code. Runner-up: a warning code in development for a link that found no opening, if sign-ins that silently fail prove hard to debug.
- **Claimed https links (App Links, Universal Links).** Still the runner-up of RFC 0142 D3; they stop another app claiming the return but not a web page or app opening it, so the opening is needed with them too.

## Residual risk
While an opening is pending, another app or a web page can send a return link first. It takes the opening, its GET under the mount carries the native cookies, and the person's real return is then ignored (the sign-in fails; the person retries). A library that changes state on a GET under its mount stays reachable in that window, a POST never. A flow started outside the app, such as an emailed sign-in link, cannot return to it through a return link, and neither can a provider flow that leaves the app a second time from a return link's callback (D1).

An opening is not proof that a person started a sign-in: any in-app navigation to a `MountHref` that ends in the external browser records one, including a link in content another user wrote, if an app renders such links. On Capacitor the launch URL can be delivered again after a webview reload; it is read as any other return link and needs a pending opening.

## Spec diff
- `spec/kernel/k.return.md` (4,555 to 5,940 characters; the limit is 6,000):
  - Status `conformance-covered` becomes `implemented`, and in `spec/00-map.md`, while the new bullets have no evidence; it goes back with the conformance commit.
  - **Mount requests**: "To `<id>:/<path>`: read as a return link that takes no opening, its GET one of those 5." before "To any other URL".
  - **Return links** rewritten: the link's form, at launch or running, other links ignored; an **Opening** bullet (D1, which openings count in k.opening); taking it (D2); what a taken link does. The intro, External browser, OAuth and app's-part prose shortened, no change of meaning.
  - **Testing**: `returnLink` delivers as the platform does; a passed `ctx` gives the clock and storage.
  - **Limits**: the residual risk.
  - Conformance: bullet 3 rewritten (it needs an opening now), three bullets added after it, and a last bullet for the redirect count through `<id>:` (D3).
- New `spec/kernel/k.opening.md` (Return-link openings, 3,164 characters, status `implemented`): chains, which record an opening and which do not (D1, D3); the stored value and a failed write (D1); Limits (the residual risk's second paragraph); six Conformance bullets. k.return is full, so these go into their own section, as k.serverlog and k.leave did.
- `spec/00-map.md`: a k.opening row after k.return, paid for by shortening eleven section titles in the map only ("and" to a comma; "Store exploration", "Pages into the mount").
- `docs/THREAT-MODEL.md` Identity: the gate, what records an opening, and the residual risk.
- Codes: none new.

## Conformance diff
One `rfc:0147` commit by the `conformance-writer`, red:
- `packages/testing/conformance/return-link-intake.test.ts`: re-quote bullet 3; its cases open an opening first; the no-opening and the second-delivery cases.
- New `packages/testing/conformance/return-opening.test.ts`: k.return bullets 4 to 6, with a sim `ctx` passed to `renderRoute` for the clock and for copying `keel.return` to a new ctx.
- `packages/testing/conformance/return-mount-link.test.ts`: k.return's last bullet (six GETs through `<id>:` redirects).
- New `packages/testing/conformance/return-chains.test.ts`: the k.opening bullets.

## Migration
- `@keel/router`: `mountRequests` records an opening on each `open` of a chain the page started, none for a chain a return link started; the intake takes the opening before reading a link; a redirect to the shell's scheme reads the link without one and continues its chain's count.
- `@keel/std-capacitor`: `Browser.close()` only for a link that took the opening. `@keel/std-tauri`: none beyond the router.
- Apps: none. A deep link to a page from outside the app no longer navigates; no golden app uses one.
- Changesets for `@keel/router` and `@keel/std-capacitor`.

## Token impact
k.return 1,485 (was 1,139). k.opening about 800, new. Map 1,200 (was 1,199).

## Open questions
- Whether a development warning for a link that found no opening is wanted (Alternatives).
