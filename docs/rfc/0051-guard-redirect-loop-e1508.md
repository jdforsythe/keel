# RFC 0051: guard redirects are bounded and `next` never nests (E1508)

Status: accepted (ADR-0040)

## Problem
- **Red team M2 (2026-11-07, backlog 0126).** A guard that redirects to a route under its own guarded layout loops forever. Repro: a layout `app.shell` with `guard: auth`, where `auth` redirects to `app.login`, and `app.login` sits under `app.shell`. `GET /login` gets `302 /login?next=%2Flogin`. That request gets `302 /login?next=%2Flogin%3Fnext%3D%252Flogin`, and so on, until the browser gives up.
- **`next` grows per hop.** Each denial wrapped the denied URL, `next` included, so every hop nests one more level.
- **No server bound.** The server does not follow redirects. Each hop is a new request, so the server never saw a loop. The client router stopped after 8 hops with `keel.unexpected` "too many guard redirects", but the server had no cap at all.
- **No check rule.** `keel check` reported nothing for a guard whose redirect route it guards.

## Proposal
1. **`next` never nests (k.router Guards).** A denial for `url` redirects with search `{ next: url }`, as before, with one exception. When `url` is on a route that some guard redirects to, and it carries a root-relative `next`, the redirect passes that `next` on instead. The rule repeats, so `next` is always the first URL that is not a guard's redirect route.
   - **Root-relative** means it starts with `/` and not with `//` or `/\`. Any other `next` is part of the URL and gets wrapped. A guard never carries another origin forward.
   - **Why only on redirect routes.** An app may use `next` on other pages, for example for pagination. `/list?next=%2Fpage2` denied still gets `next=/list?next=%2Fpage2`.
   - **Shared helpers.** `guardNext`, `withNext`, and `guardLoop` live in `@keel/router/internal`. The server and the client router use the same code.
2. **E1508 at runtime (one code, owned by k.router).** A guard redirect is E1508 when its location was already visited in this request or navigation, or when it would be redirect number nine. The visited list starts with the request URL and adds each redirect location.
   - **Server.** Before answering a denial, the server runs the target's guards in-process, hop by hop, as the browser would on the next request. It stops when a hop does not redirect (pass, a non-denial `err`, or no matching route), and then answers the first 302 (303 for a write). On E1508 it answers a `keel.unexpected` failure at the denying level instead: 500, rendered at the nearest `errorElement`, with message `unexpected` in production. The dev log gets a `diag` record `E1508`.
   - **Client router.** It runs each hop for real, as it did before, and applies the same check. The old 8-hop counter is replaced, so a two-route cycle stops at the first revisit, not after 8 hops.
   - **Cost.** One extra guard run per denial, for the target's guards. A login route with no guard costs nothing. Guards should be read-only checks. The server ignores any extra guard runs except for their result.
   - **Hop cap N = 8.** This is the client router's existing limit. Locations repeat exactly once `next` is stable, so the cap only catches chains of more than 8 distinct guarded routes.
3. **E1508 in `keel check` (static half).** A project pass reports a guard whose literal `redirect` route has that same guard in its chain. The finding is on the `redirect` literal of the `guard(...)` call: `guard auth redirects to app.login, which auth guards: a redirect loop`.
   - **What it reads.** `guard({ redirect: '<literal>' }, fn)` in any app file. In `manifest({...})` literals it reads each route's literal `layout` and `guard: <identifier>`. The identifier is a local const, or a named import from a relative path; `.ts`, `.js` and no extension all resolve.
   - **Limits (documented in the rule).** It does not report a computed `redirect`, a guard reached any other way, or a loop through two or more guards. Those are left to the runtime half. A guard that lets its own redirect route through by inspecting `url` is still reported: a guard must not cover its own redirect route.
   - **No fix.** Which route moves out of the guarded layout is a design choice.
4. **Why one code in k.router.** The behaviour is the k.router Guards rule. The client router enforces it as well as the server, and the static rule describes the same defect. Precedent: E1505 and E1507 are both static and runtime. An E155x code would cover only the server half. A k.check E175x code would be a structure rule outside the kernel section that owns guards.
5. **Amendment (backlog 0145, 0146): a carried `next` is vetted, and unwrapping is bounded.**
   - **0145.** URL parsers strip tab and newline, so `/<TAB>/evil.example` was carried as a path but resolves to another origin. `/login?next=%2F%09%2Fevil.example` gave `302 /?next=%2F%09%2Fevil.example`. Now a `next` is carried only when all of these hold (`carriedNext`):
     - it is at most 2,048 characters long (`MAX_NEXT_LENGTH`);
     - it has no ASCII control character (0x00-0x1F, 0x7F);
     - it starts with `/` and not with `//` or `/\`;
     - `new URL(value, base)` keeps the base origin.

     Otherwise the `next` is dropped. A redirect route's URL is carried without its `next` key, so that request now gets `302 /?next=%2Flogin`.
   - **0146.** `guardNext` reparsed the rest of an unencoded `"/login?next=".repeat(n)` at every level. The cost grew with the square of the depth: 24 ms for 15.6 KB. Now it makes one pass of at most `MAX_GUARD_HOPS` levels. Each level is at most 2,048 characters, so the parse count is bounded, and a level past the cap drops its `next` the same way. Tests count `URLSearchParams` constructions on a 16 KB input. They do not time it.

## Alternatives
- **Static detection only on the server** (refuse when the target's chain holds the same guard value). Rejected: a guard may allow its own redirect route by `url`, and then the server would refuse a working app. In-process evaluation is exact for deterministic guards.
- **Unwrap any `next`.** Simpler, but it breaks apps that use `next` for their own purposes, and it moves an arbitrary `next` forward.
- **A redirect counter in the URL (`?hops=3`).** It adds a public search key that every route would have to tolerate, and a client can forge it.
- **`manifest()` throws E1508.** A manifest sees only its own routes, but a deployable's guards resolve in the union, so it would miss cross-module loops. It also rejects the url-allowing guard above at import time.
- **A k.server code (E1556).** It would split one behaviour across two codes.

## Spec diff
- **k.router Guards.** "on `err` the request redirects to `redirect` with search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested). A redirect revisiting a location, or a ninth, is E1508 (rfc:0051)."
- **k.router Rules.** Adds "E1508 a guard's literal `redirect` route is under that guard, or (runtime) a guard redirect loop."
- **k.router Conformance.** Adds "A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`."
- **Editorial, to stay under 1,500 tokens (1,477 to 1,493).** Cross-reference words that add no rule are cut: the code-example comments (`// no path: a layout`, the `params`, `search` and `loader` comments), "(k.module)", "(k.server)", "(k.compiler)", "(k.forms)", "(a form's own is `f.pending()`, k.forms)", and "`RouterHistory` keeps". No rule changes.
- **k.server** is unchanged. Its request flow already says "guard (deny: redirect)", and k.router Guards owns the rule.

## Conformance diff
- **Added** `packages/server/conformance/guard-redirect-loop-e1508.test.ts`, written by conformance-writer from the spec text. It covers:
  - the backlog repro, which is 500 rather than `302 /login?next=%2Flogin`, with no stack in production and a dev `diag` E1508;
  - a two-route cycle;
  - 8 hops answering 302 and 9 answering 500;
  - `next` kept across a two-hop chain;
  - a clean counterpart;
  - a fast-check property, seed 1337: for arbitrary guard graphs, every request answers 200, 302 or 500, no `Location` nests `next`, and following `Location` ends within 9 requests.
- **Added** `packages/router/conformance/guard-redirect-loop-e1508.test.ts`. The client router renders E1508 `keel.unexpected` at the denying level's `errorElement`, or at the default alert, and a two-hop redirect lands with `next` equal to the original URL. Edit after writing: the fixture's `errorElement` moved from the redirect route to the guarded layout, because a guard failure renders at the denying level, as with every other guard `err`.
- **Changed** `packages/check/conformance/fixtures-by-code.ts` adds an E1508 fixture and its clean counterpart. `fix-diffs.test.ts` lists E1508 as no-fix.
- **Unit tests.**
  - `check/test/guardRedirectLoops.test.ts` covers the static half: a layout, two layouts up, aliases, `.js` and extensionless imports, a local guard, clean cases, computed values, test files, and a layout cycle.
  - `router/test/guardRedirect.property.test.ts` is a property test of `nextOf`, `guardNext`, `carriedNext` and `guardLoop`. Its cases cover arbitrary strings, tab, newline and backslash, the depth and length caps, and a parse count on a 16 KB input.
  - `router/test/mutants.dom.test.ts` has two changes. A two-route loop now stops at the first revisit with E1508. The "below the limit" case is now 8 distinct hops landing and 9 failing, because the old case revisited `/a` and `/b`.
  - `server/test/guard-redirect.test.ts` covers:
    - a write loop;
    - a follow-up hop that fails;
    - a foreign or unrecognised `next`;
    - the compact dev log line.

## Migration
- An app whose guard covers its own redirect route now gets E1508 from `keel check` and 500 on the server, where before it looped in the browser. Move the redirect route out of the guarded layout.
- A URL on a guard's redirect route with a root-relative `next` passes that `next` on when it is denied. Apps that read `next` on their login route see the original target, not a nested one.
- A carried `next` that is longer than 2,048 characters, holds a control character, or leaves the origin is dropped (0145, 0146).
- `@keel/router/internal` gains `guardNext`, `guardLoop` and `withNext`. It is not public API.

## Token impact
- k.router: 1,477 to 1,493 tokens.
- E1508 explain: about 50 tokens.
- One `diag` line per looping request in the dev log.
