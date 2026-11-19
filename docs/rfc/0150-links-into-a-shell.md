# RFC 0150: links into a shell

Status: draft, for the orchestrator to accept (ADR-0172). Amends RFC 0147 D1 and D2.

## Decisions
Made in the build, for the orchestrator to confirm or reverse.
- B1: the test handle's `launch(links)` returns a promise that resolves once the reported links are delivered and the page has settled, as `returnLink` does (k.links Testing).
- B2: a shell's second launch report changes nothing: it records, drops and delivers nothing. Under `renderRoute(id, { shell: true })` without `launch: 'later'` the handle's `launch` is such a report (k.links Launch).
- B3: a held opening recorded by a report of no link has its deadline 600000 ms after it opened (k.links Launch).
- B4: a later opening ends the held one even when its write fails, so the report of no link then records nothing: fail closed (k.links Launch).
- B5: a link delivered before the launch report is sorted as any other and leaves the held opening held. Only the test handle can do this: the shells listen for running links after their report.
- B6: the `fire` events that count as a person's act are the ones k.opening Testing names (`click`, `submit`, a `keydown` other than Escape); the router's internal `personActs.fired` classifies them for the harness.
- B7: E1580 accepts `{}` or `{ links: [...] }` (an array literal) as the second argument; any other second argument (`{ links }`, `{ links: v }`, another key, a computed key) or a third is E1580. An entry of the array literal that is not a string literal is E1584 at that entry.
- B8: the open questions are closed: no development warning when a link-started chain opens the external browser, and no std auth adapter supplies `links`; the app declares them.
- B9: a launch counts as link-started whenever it was not known to be link-free. A report that names links, or a failed read (`null`), drops the held opening and makes the ctx link-started until a person acts, whether or not a reported link is taken: a launch link that is ignored, or refused for want of an opening, counts too. Only a report of no link releases a held opening. Link-started is read as the browser opens, so a mount request in flight when such a report arrives records none (k.links Launch, k.opening Link-started). Without this, a cold start by a hostile link whose path is refused left the next auto-started sign-in recording an opening that link's sender could take.
- B10: an opening is recorded by `ctx.storage` `set` and taken by `commit`. The k.opening older-opening case fails the `set` that records the second opening while `commit` still works, so the link at 599999 ms takes the older one: fail closed, without contradicting k.links' take in one `commit`. A link whose take cannot `commit` sends nothing and leaves `keel.return` as stored (k.links Return links). The `commit` bullet sits in k.opening, which has the conformance setup for it; k.links had no room.
- B11: a mount answer's `location`, or a return link, whose path begins `//` or `/\` once dot segments are removed (`/.//evil.example/x`) is ignored: nothing opens in the external browser and nothing navigates, so no path on `KEEL_ORIGIN` can become a protocol-relative URL to another origin. The rule sits in k.return Mount requests, which describes what leaves for the external browser; k.links points there through "as k.return".
- B12: two limits are stated, not closed: a declared path's own redirects are the app's to vet (one to `<id>:/<path>` reaches the path it names); where another app can launch this app with no link, a sign-in the app starts on render with no act records an opening that app's link can take (k.links Limits, THREAT-MODEL Identity).
- B13: to fit k.links under 6,000 characters, its Testing launch sentence moves to k.return Testing and the Capacitor and Tauri report sentence and the webview-reload sentence move to k.return Return links, wording unchanged; k.opening Testing becomes "As k.links.", which names the same handles through k.return.
- B14: a return link or a `location` whose text does not parse is ignored, and delivery continues in order: a launch report's later links are still delivered, and `link` resolves having sent nothing, so a shell's `void link(...)` or `void launch(...)` rejects with nothing (k.links Return links "other links are ignored").
- B15: a path is refused when a URL parser reads it as naming a host: it parses to one origin against two different stand-in bases. This covers `//` and `/\` and the same past tabs, newlines and leading control characters, and the stand-in origin itself (`<id>://keel.invalid/x`, `Location: //keel.invalid/x`), which comparing with one base let through. The after-normalisation `//` test stays (k.return Mount requests).
- B16: k.return Mount requests says what the code does: a redirect to another origin opens in the external browser only when it is `http:` or `https:`; any other scheme (`javascript:`, `data:`, `file:`, `intent:`) is ignored.
- B17: link-started is per ctx, in memory; a webview reload starts a new ctx, link-started only by its own launch report. Stated as a limit in k.return Limits (k.links had no room) and THREAT-MODEL Identity.
- B18: `personActs.mark` is module-private: outside the router's trusted-event listener, `fired` (a test harness's `fire`) is the only way to mark an act. The router's own tests mark acts through `fired`.

## Problem
RFC 0147 admits a return link only against a pending opening, and every link, a page link included, needs one. That is too strict and, at one point, too loose:
- A shell's scheme is also the app's deep link. A link to a page (`<id>:/orders/42`) is as safe as a web link to that page, yet with no opening it is ignored.
- A magic-link or verify-email callback is tapped in a mail app, with no opening in the app. It cannot reach the mount at all.
- A chain a return link starts records no opening, but that origin ends where the chain hands over to a page. A sign-in page that starts its provider on render (reached by a guard redirect after the link lands) records a fresh opening, and the sender's next link takes it: one link per cycle, without end, each GET under the mount carrying the native cookies.

## Proposal

### D1. Links by path
A return link `<id>:/<path>?<search>` is sorted by its path (k.links Return links):
- A page the router matches: a client-side navigation, at any time, as a web link to that page. It takes no opening.
- `handle.path` plus a declared subpath (D2), exactly, any search: a mount request GET at any time, with the headers of any mount request GET (`x-keel: 1`, `accept: application/json`, `redirect: 'manual'`). It takes no opening.
- Any other path under `handle.path`: as RFC 0147, it takes the pending opening first, or is ignored with no request.
- Any other path: ignored, the opening left pending.

A page link or a declared path leaves a pending opening pending, so the OAuth return it waits for still works. Kept from RFC 0147: one opening per link, the 600000 ms deadline, the stored value rules, a redirect to `<id>:/<path>` continuing its chain and counting toward the 5 in a row, a chain a return link starts recording none, and a failed write admitting nothing while an older pending opening stays pending until its own deadline.

### D2. The declaration
`identity.ts` already default-exports `identityMount(path)`; it takes an optional second argument:

```ts
import { identityMount } from '@keel/router';
export default identityMount('/api/auth', { links: ['/magic-link/verify', '/verify-email'] });
```

Each entry is a subpath of `href`'s `subpath` form (`/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`), not `''`, none repeated: so `path` plus it is a path under `path`, matched exactly, with no search of its own; the link's search is passed on. The result's `links` holds them (`[]` by default). `keel check` gives E1584 for an entry that is not a string literal, is `''`, is not of the subpath form, or repeats one; the call throws E1584 at run time for a literal. E1580 accepts the second argument. A browser build ignores `links`: on the web every path is already reachable by a link.

Declaring a path asserts that the library's handler there is safe to receive unsolicited, from any app or page, with the user's cookies, as it is on the web. Keel checks the form only, never what the handler does.

### D3. A sign-in a link sets off records no opening
A ctx is link-started from the moment a delivered return link is taken (a page link navigates, a declared or opening-admitted link sends its GET) until a person next acts. While it is, every mount request, whoever starts it (the link's chain, a page that navigates to the mount on render after a guard redirect, `navigate`, `ok(href)`), opens the external browser where k.return says and records no opening. The state is read as the browser opens, per ctx, in memory only. A redirect to `<id>:/<path>` within a chain is no delivered link and starts nothing.

A person's act: a trusted `pointerdown`, `pointerup`, `mousedown`, `touchend`, or `keydown` other than Escape on the page, heard at the window in the capture phase; a script's `click()`, `requestSubmit()` or dispatched event is none. A sign-in a page starts at an ordinary launch, with no link, records an opening as RFC 0147 states.

### D4. The launch
A shell may learn its launch URL after the first render (Capacitor's `getLaunchUrl` is asynchronous), so a cold start by a link could otherwise record an opening that the launch link then takes. The shell reports its launch once: the links it was launched with (none for an ordinary launch), or that it could not read them. Until the report, an opening made with no person's act since the ctx started is held: the browser opens, nothing is stored. A report of no link records the last held opening as of when it opened (its deadline 600000 ms from then), unless a later one was recorded; a report of links, or of a failed read, drops it and makes the ctx link-started (D3) until a person acts, whether or not a reported link is taken, then delivers the links in order (B9). A shell that never reports records no opening before a person's act: fail closed.

What a shell provides: one launch report through the router's intake, after its launch read settles. std-capacitor reports when `App.getLaunchUrl()` settles (no URL: no link; a rejection: a failed read); std-tauri when `getCurrent()` settles (`null`: no link; a rejection: a failed read). Running links (`appUrlOpen`, `onOpenUrl`) are listened for after the report.

### D5. Testing
`renderRoute(id, { shell: true })` reports a launch with no link before the first render, so existing cases keep their meaning. With `launch: 'later'` it reports none until the handle's `launch(links)`, `links` an array of URLs or `null` for a failed read. A `fire` of `click`, `submit`, or `keydown` with a `key` other than `Escape` is a person's act; other `fire`s, the handle's `navigate` and `settle`, and events the page's code dispatches are not.

### D6. Where it lives
`@keel/router`: `identityMount`'s `links` (registered beside `mountPaths`), the sorting in the intake, the link-started flag and act listener in `mountRequests`, the launch report and held opening. The checker: E1584 and the widened E1580. std-capacitor and std-tauri: the launch report. `@keel/testing`: `launch: 'later'` and the handle's `launch`.

## Alternatives
- **Every link needs an opening** (RFC 0147). Breaks deep links to pages and every emailed callback.
- **Declared paths as patterns** (`/verify/*`) or with a search. Rejected: an exact path is checkable at build time and cannot grow to cover a handler nobody reviewed.
- **Declared paths at run time** (a shell option, or read from the server). Rejected: not checkable, and a server answer could widen the set.
- **A diagnostic for declared paths that look state-changing by name.** Rejected: names prove nothing either way; the declaration is the app's assertion.
- **An opening needs a person's act** (every opening, not only one after a link). Rejected: it stops a sign-in an app starts at an ordinary launch, a flow with no link in it.
- **Treat the launch as no link until told otherwise.** Rejected: on Capacitor the launch link arrives after the first render, so an auto-started sign-in would record an opening the launch link then takes.
- **A time bound on link-started.** Rejected: the attack needs no time, and a person's act is the signal that matters.

## Residual risk
A page link is as open as a web link to that page. A declared path is reachable by any app or page at any time with the native cookies. While an opening is pending, another app or page can send its link first and take it. An app that starts a sign-in on render of a page a link lands on opens the browser, but no return is admitted until the person acts and starts it again. After any act, whatever it was for, a mount navigation records an opening. A declared path's own redirects are the app's to vet. Where another app can launch this one with no link, an app that starts a sign-in on render with no act records an opening that app's link can take.

## Spec diff
Sizes in characters; the section limit is 6,000, the map's 4,800.
- New `spec/kernel/k.links.md` (5,989), `implemented`: Return links (moved from k.return and rewritten by path; a take whose `commit` fails is ignored, B10), Opening (moved from k.return; written by `set`), Launch (a report of links or a failed read makes the ctx link-started, B9), Testing ("As k.return, launch included"), Limits (the link risks, moved from k.return and k.opening; B12), Conformance.
- `spec/kernel/k.return.md` (5,948 to 5,367), `conformance-covered` to `implemented`: Mount requests ignores a `location` whose path begins `//` or `/\` (B11); Return links points to k.links and k.opening and holds the shells' launch report and the webview reload; Testing holds the launch handle; Limits keeps the device checks and adds "Link-started (k.opening) is per ctx, in memory: a webview reload starts a new ctx, link-started only by its own launch report." (B17); Mount requests reads "To any other `http:` or `https:` URL: it opens in the external browser; any other scheme is ignored." (B16); three bullets move to k.links, one is added.
- `spec/kernel/k.opening.md` (5,930 to 5,970), `implemented`: Chains names the declared path; Acts becomes Link-started, which a launch report of links or a failed read also starts; Stored value names `set`; Testing is "As k.links"; Limits rewritten.
- `spec/kernel/k.mount.md` (5,213 to 6,000), `conformance-covered` to `implemented`: Declaration's `links`, E1580 widened, E1584, one bullet.
- `spec/00-map.md` (4,791 to 4,799): the k.links row; status of k.mount and k.return; shorter titles for k.return and k.opening.
- `docs/THREAT-MODEL.md` Identity: the shell part rewritten for D1 to D4, B9 to B12 and B17.
- Codes: E1584 (k.mount, block E155x).

## Conformance diff
One `rfc:0150` commit by the `conformance-writer`.

Moved, wording unchanged (their describe names change from k.return to k.links): the k.return bullets "`returnLink('dev.keel.golden2:/api/auth/callback?code=c')` with no opening sends nothing; ...", "After such an opening, a link to a page navigates; ...", and "After two openings, two links send one GET. ...".

Reversed:
- k.return's "With none pending, or past its deadline, it is ignored: no request, no navigation": the test "with no opening, a link to a page navigates nowhere and sends nothing" (`return-link-intake.test.ts`) goes; the k.links bullet "With no opening, `returnLink('dev.keel.golden2:/about')` navigates ..." replaces it.
- k.opening's "With no opening first, `renderRoute` of `/auto` with no `fire` ...; the link then sends nothing" now ends "sends one GET".

Removed from k.opening, with their tests in `return-acts.test.ts`:
- "`returnLink('dev.keel.golden2:/auto')` navigates to `/auto` and records ... again; the link then sends nothing": replaced by the k.links bullet "With no opening, `returnLink('dev.keel.golden2:/auto')` ..." (a pending opening now stays pending).
- "With no opening first, a `fire` `input` on a field, then the handle's `navigate('/auto')`, ...": replaced by the k.opening bullet "The link's GET answered 303 to `/`, ...".
- The Acts sentence "So each act admits at most one return link ..." and its property: replaced by the k.opening sequence bullet.

Unchanged and still cited: every other k.return and k.opening bullet, among them "The link's GET answered 302 to `/auto`, ... after a second `Link` to the mount, a third sends one GET" (a `Link` after an act records again), the `fire` `click` and `fire` `submit` bullets, and the older-opening bullet.

Added: k.links' last six bullets (a page link with no opening; a declared path's GET; undeclared paths; the held launch opening; a page link landing on `/auto`; a declared path's chain records none), k.opening's two last bullets (acts after a link; the sequence model), k.mount's E1584 bullet. Fixtures: a mount declared with `links: ['/verify']`; the act pages' `/` reached by a 303.

Added or reworded by B9 to B12, verbatim:
- k.links, added (B9; extends `links-launch-later.test.ts`): "With `launch: 'later'`, `renderRoute` of `/`, then `launch` of `['dev.keel.golden2:/api/auth/callback?code=c']`, of `null` or of `['dev.keel.golden2:/elsewhere']`, then the handle's `navigate('/auto')` records `https://provider.example/a` in `documents()`; the callback link then sends nothing."
- k.links, added (B9; extends `links-launch-later.test.ts`): "With `launch: 'later'`, `renderRoute` of `/auto` whose mount GET is answered 302 to `https://provider.example/a` only once `launch(null)` is called records that URL in `documents()`; the callback link then sends nothing. With `launch([])` instead, one GET."
- k.opening, reworded (B10; `return-acts.test.ts` fails `set` only, keeping `commit`): "An opening at 0 ms (sim clock), then a second at 300000 ms with a `ctx.storage` whose `set` now fails, its `commit` still working: the link at 599999 ms sends one GET; delivered first at 600000 ms instead, it sends nothing."
- k.opening, added (B10; `return-acts.test.ts`): "With a `ctx.storage` whose `commit` fails, the link sends nothing; a new ctx given that ctx's `keel.return` value then admits the link once."
- k.return, added (B11; a new case in `return-chains.test.ts` or its own file): "A `Link` to `mount.href('/login/github')` answered 302 to `/.//evil.example/x`, or to `/\evil.example/x`, records nothing in `documents()`, sends no second `net` GET and keeps the page; `returnLink('dev.keel.golden2:/.//evil.example/x')` sends nothing and keeps the page."

Moved, wording unchanged (B13): k.links Testing's launch sentence to k.return Testing; the Capacitor and Tauri report and the webview reload to k.return Return links. No bullet cites them.

## Migration
- `@keel/router`: `identityMount(path, { links })`; the intake's sorting; link-started in place of the act-gated record; the launch report and held opening. Router tests that open with `navigate` alone pass with no `fire`.
- Checker: E1584 with its explanation; E1580 widened.
- std-capacitor, std-tauri: the launch report; READMEs.
- `@keel/testing`: `launch: 'later'`, the handle's `launch`; its README and the keel-testing skill.
- Apps: none required. An app with an emailed sign-in link declares its path. Changesets for each package.

## Token impact
k.links about 1,340 tokens, new. k.return falls by about 430; k.mount rises by about 200, to the 1,500 limit. Map at 1,200.

## Open questions
None: B8 closes both.
