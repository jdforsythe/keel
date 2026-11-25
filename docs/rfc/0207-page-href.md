# RFC 0207: k.router: `pageHref` reads a string into an `Href` of a page of the route table

Status: implemented (ADR-0229), accepted by the orchestrator on 2026-11-23. Amends k.router (Links, a new Return targets paragraph, Execution, Conformance), k.server (API), k.user (Identity source), k.guards (Guards), the map. From `apps/household` (walkthrough finding L4-3, backlog 1008).

## Decisions
- D1: one reader, `pageHref(routes, text)` in `@keel/router/match`, `Result<Href, KeelError<'keel.notFound', null>>`. It is the only way a string becomes an `Href` other than a contract's `href` and an identity mount's `href`.
- D2: the answer is rebuilt from the match by the page's contract's `href`, never copied from `text`. A page of the app's own table is the only thing it can name.
- D3: before matching it refuses, as a security boundary that does not lean on the matcher: over 2,048 characters, not exactly one leading `/`, a `\` or control character anywhere, `%2F` or `%5C` in the path, a `.` or `..` segment once decoded.
- D4: after matching it refuses a path no page matches (API entries, the identity mount, undeclared paths, params that fail) and a page that is the `redirect` route of any guard in the table (a loop).
- D5: search survives as the page's declared keys that parse, sorted; undeclared keys and the hash drop. There is no base path: a deployable is served at its origin's root.
- D6: an action's args carry `routes`, the table it is served from; `handle.fn` gets `{ routes }` as a third argument. `run` without `routes` gives `routeTable()`, on which every read is refused.
- D7: `matchHref` is unchanged and gains no `Href`: it is the navigation matcher, and a second, unvetted string-to-`Href` path would be the open redirect this RFC closes.
- D8: no new diagnostic. A refusal is a value the caller narrows on; nothing is thrown.

## Problem
A guard denial redirects to the guard's `redirect` route with search `{ next: url }`, the request's path and query (k.guards). The page that receives it can send the person back only by writing an `Href`: an action's `ok(href)` takes `Href` only, and `Href` is branded. The router offers no reader from a string to an `Href`. `matchHref(routes, href)` reads a string and answers `{ id, params, search }`; rebuilding needs the target module's contract, which `deps` forbids (L4-4), and an action does not hold the deployable's table at all.

What the tree does today:
- `apps/household/modules/setup/saveSetup.server.ts` answers `ok(null)` and the page says where to go (L4-3): the return is not followed.
- `apps/household/identity.server.ts` writes the 303 itself. Its `local(next)` admits a string that starts with `/`, not `//`, and holds no `\`, and puts it in `location` as a plain string. `examples/shell-mount/identity.server.ts`'s `pathOf` is the same check. Both admit `/\t/evil.example/x`: a URL parser strips the tab and reads `//evil.example/x`, so `new URL('/\t/evil.example/x', 'https://app.example').href` is `https://evil.example/x`. Each app wrote its own open-redirect check, and both are open redirects.
- `apps/household/modules/members/nextOf.ts` carries `next` from page to form post as a string; that part is right, since only the final write needs to vet it.
- The router already vets `next` when a guard carries it forward (`carriedNext`: 2,048 characters, no control character, same origin), and `isHref` brands contract output. Neither is public, and neither checks that the string names a page.
- `apps/golden-1` and `apps/golden-2` redirect to index pages and carry no `next`; `apps/golden-2/identity.server.ts` returns to a page it builds from a contract.

## Proposal
### The reader
```ts
import { pageHref } from '@keel/router/match'

export const saveSetup = action(setup, 'setup.form', { input: SetupForm, stores: householdStores },
  async (input, { url, caller, stores, routes }) => {
    const r = tx(stores.name, input, { meta: { caller } })
    if (!r.ok) return err(r.error)
    const back = pageHref(routes, new URL(url).searchParams.get('next') ?? '')
    return ok(back.ok ? back.value : null)
  })
```
`pageHref(routes, text)` refuses `text` that:
1. is longer than 2,048 characters (the guard's own bound), or does not start with exactly one `/`;
2. holds a `\` or a control character (C0, DEL or C1) anywhere, so the tab and newline a URL parser strips never reach one;
3. holds `%2F` or `%5C`, either case, before its first `?` or `#`, or a segment that is `.` or `..` once decoded, so a server or proxy that decodes before routing reads the same path;
4. names no page as `matchHref` matches: an API entry, the identity mount (no page of the table), an undeclared path, params that fail;
5. names a page that is some guard's `redirect` route in the table.

The refusal is `err({ code: 'keel.notFound', message: 'not a page', data: null })`. The text is not echoed: a `next` can carry personal data in its query, and a log of the error should not.

Otherwise the answer is `ok` of the page's contract's `href(id, params, search)` for the match. The path is re-encoded from the decoded params; the query keeps the keys the page's `search` schema declares and parses, sorted as `href` sorts them; the hash drops. Since the output is built and not copied, rules 1 to 3 are defense in depth, and the rule a test can break is the match: a string that names no page cannot get through.

### Where the table comes from
An action is defined in a module and cannot import the deployable's table: the generated entry builds it from every module (k.routes Union). So the router hands it over:
- an action's `fn` args gain `routes`, the table the request is served from: `createApp`'s `routes` on the server, the router's table in a client-only app's browser;
- `handle.fn(request, ctx, { routes })` for an identity source (k.user), since a sign-in's 303 is written there;
- `run(input, args, ctx)` takes `args.routes` as optional; absent, `routeTable()`, so a test that does not pass one sees every read refused, which is the safe default.

Loaders and guards do not get it: a loader passes `next` through as the household's `nextOf` does, and only the write that sends the person needs to vet it.

### Query, hash, base path, loops
- Query survives as the target page's declared search: the person returns to `/list?tab=b`, and a key the page does not declare drops as it does on navigation.
- The hash drops: an `Href` holds no `#`, and a browser never sends one in the request a guard sees.
- No base path: no section gives a deployable one, so every `Href` is root-relative to its origin, and the spec now says so. A base path, if one is ever proposed, is one `pageHref` and `href` take together.
- Loop: the page a guard sends the person to is never a return target. `/signin?next=%2Fsignin` returns to the start page, not to sign-in again. A page whose own guard denies again is the guard redirect loop E1508 already catches.

### Opt-in
`pageHref` is an export of `@keel/router/match`; an app that imports it pays for it. `routes` on the args is a reference the server and router already hold. An app with no guards makes no request, carries no config and no bytes for it.

## Alternatives
- **`matchHref` returns an `Href` too** (an `href` member of `RouteMatch`). Rejected: `matchHref` matches as navigation does, for std-sessions replay and redaction, and admits what navigation admits (an encoded slash in a param, a guard's redirect page). An `href` on it would be a second string-to-`Href` path with weaker rules, and `matchHref(routes, next)?.href` would read as the safe one.
- **`matchHref` returns a `Result` and gains the refusals.** It would change the navigation matcher's answers for replay, and `null` callers in std-sessions would all change, for a question they do not ask.
- **A plain `isSafeNext(text): boolean` beside the apps' checks.** It leaves the app copying `text` into `location`, so a rule it misses is an open redirect; and it does not make an `Href`, so `ok` still cannot take it without a cast.
- **Bind the table to `ctx`, as `stdConfig` binds config.** Hidden state: two `createApp`s on one ctx in a test would share one binding. Args are explicit and typed.
- **Accept a same-origin absolute URL.** The action would need the origin the browser saw, which a forwarding peer changes; a guard writes `next` as a path, so nothing needs the absolute form.
- **A check rule for a hand-written 303 `location` from search.** A taint analysis across `handle` bodies; the reader removes the reason to write one. Noted for `tasks/FUTURE.md` if one turns up.

## Spec diff
Applied in this commit.
- k.router (to `implemented` until its four new clauses are covered): Links names the three ways a string becomes an `Href`; a new **Return targets** paragraph defines `pageHref`; Execution lists it in `@keel/router/match`; Conformance gains four clauses (#17 to #20).
- k.server (stays `conformance-covered`; its new sentences are covered by k.router#19 and #20): an action's `fn` args list `routes`; `run`'s `args.routes` is optional, absent `routeTable()`.
- k.user (stays `conformance-covered`; covered by k.router#20): `handle.fn(request, ctx, { routes })`.
- k.guards (stays `conformance-covered`): one sentence pointing the return at `pageHref`; no new behavior.
- Map: the k.router row reads `implemented`. No new code: the `E150x` block is unchanged.
- Ledger: k.router#17 to #20 at `none`, written by the orchestrator's regeneration (`ledger-fresh` lists them).
- No glossary term is added; no budget moves.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/router/conformance/page-href.test.ts`: k.router#17 and #18, over the fixture `t` they define. A property test beside it, by the builder: for every route and generated `p`, `q`, `pageHref(t, c.href(id, p, q))` is `ok(c.href(id, p, q))` unless `id` is a guard's `redirect` or a param holds `/`, `\`, `.` or `..`.
- `packages/router/conformance/page-href-action-routes.test.ts`: k.router#19 (client router and `run`).
- `packages/server/conformance/page-href-server-routes.test.ts`: k.router#20 (`createApp` action args and `handle.fn`'s third argument).
- Existing cases: `packages/server/conformance/identity-handle.test.ts` calls `fn` with two arguments; a third is additive and no assertion reads arity. The writer confirms no test asserts an action's args by deep equality.

## Migration
None. No app is released.

## Token impact
- Spec: k.router grows by about 1,020 tokens to about 2,520 of 3,100; k.server by about 50, k.user by about 40, k.guards by about 25. The map is unchanged in size.
- `@keel/router`: `pageHref` reuses `matchUrl`, `encodeHref` and the guard-redirect set `guardNext` builds; a few hundred bytes in `@keel/router/match`, outside the client entry for an app that does not import it. Size to measure in the build.
- Skills: one line in `keel-server` (the sign-in return) and one in `keel-client`; within their targets or re-based in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the four clauses. 3. Build:
- `packages/router/src/match/pageHref.ts` (new), exported from `src/match/index.ts`; the refusals before the match in `packages/router/src/internal/returnRefused.ts` (new), sharing the control-character test with `isHref` and `carriedNext`.
- `packages/router/src/action.ts` and the router's action call (`createRouterWith.ts`): `routes` on the args; `run` defaulting to `routeTable()`.
- `packages/server`: the action args and `handle.fn`'s third argument (`createApp`'s request flow and its `identity` call); the `identity()` type in `@keel/server`.
- `apps/household/identity.server.ts`: drop `local`, return to `pageHref(routes, next)` or the start page; `saveSetup.server.ts` returns to `next` when `pageHref` accepts it (closes L4-3); a test for `/\t/evil.example/x` in `test/signin.test.ts`.
- `examples/shell-mount/identity.server.ts`: drop `pathOf`, use `pageHref`.
- Docs: `@keel/router` README, `keel-server` and `keel-client` skills (copied to `.claude/skills`), a changeset, `tasks/p1/walkthrough-findings.md` (L4-3), `tasks/BACKLOG.md` 1008.

## For the operator
1. **The guard's redirect page is never a return target.** Recommended: yes; a return to the sign-in page is a loop, and the action falls back to its start page.
2. **A page whose path param holds `/` or `\` is never a return target** (its `href` writes `%2F` or `%5C`). Recommended: yes; the person lands on the action's fallback, and every proxy in front of the app reads the path the same way.
