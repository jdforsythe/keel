# RFC 0027: Loaders and actions declare their route schemas; `url` replaces `location`

Status: accepted

## Problem
Backlog 0100 (k.server and k.router parts, from red-team 0082 and 0086). Commit d29117a added `RouteFit`, so a hand-typed `params` that does not fit the route fails at `manifest`, but `fn` still had to be annotated: `loader(output, fn)` is declared before its route, so nothing can infer `params`/`search`, and the spec example `loader(Order, async ({ params, search }) => ...)` cannot be typed. Two ways to type them exist (annotation or `unknown`), against principle 1, and the schema is restated as a TS type against principle 4. Server code also read `location` (inspector), which does not exist on a server. d29117a's `undoOwn`/`canUndoOwn` and the `keel-caller` cookie are unspecified.

## Proposal
- `loader({ output, params?, search? }, fn)`; `fn({ params, search, url }, ctx)`. `action({ input, params? }, fn)`; `fn(input, { params, url }, ctx)`. `params`/`search` are `Infer` of the declared schemas (`unknown` when omitted); `fn`'s parameters use `NoInfer`, so an annotation cannot widen or replace them and a hand-typed shape does not compile.
- The declared schemas are the referencing route's own values: `manifest` throws E1507 when a loader's `params`/`search` or an action's `params` is set and is not the route's value. `RouteFit` still rejects a route whose parsed values do not fit.
- `url` is the absolute request URL: `Request.url` on the server; in a client-only app the router resolves the page path (loader) or the action route's `href` (action) against `document.baseURI`.
- k.router Rules E1507: hand-typed `params`/`search`, or a schema other than the route's. `manifest` throws for the second; a `keel check` rule for the first is follow-up (packages/check owned elsewhere this batch).
- k.server documents `undoOwn`/`canUndoOwn` and the `keel-caller` cookie (HttpOnly, SameSite=Lax, Path=/, Secure on https) as shipped in d29117a. `keel.conflict` 409 is not implemented and not specified.

## Alternatives
Infer from the route by declaring loaders inside `routes.ts`: breaks the `*.server.ts` split (E1551). A `route.loader(fn)` builder bound to a declared route object: a second declaration step and import cycles between `routes.ts` and `*.server.ts`. Keep the annotation and only check fit (d29117a): two ways, schema restated as a type. `location` behind a ctx capability: `url` is per request, not per process.

## Spec diff
k.server API: example, both signatures, `params`/`search`/`url` bullet, `undoOwn`/`canUndoOwn`/cookie bullet; app code sees `topology`, `undoOwn`, `canUndoOwn`; Conformance +2 (loader `url` absolute; `undoOwn` refused for another caller). k.router Manifest example (named `OrderParams`/`OrderSearch`, comments); Rules + E1507; Conformance +1 (inferred `params`, E1507 on another schema value). Map unchanged (E15xx is k.router).

## Conformance diff
Added only: router `loader-params-inferred.test.ts` (expectTypeOf of `params`/`search`/`url`/action `params`; E1507 for loader params, loader search, action params); server `loader-url-absolute.test.ts` (runtime and document requests), `undo-own-caller.test.ts` (another caller's undo is 403 and changes nothing; the owner's then succeeds; a cookieless caller undoes nothing). Existing suites unchanged.

## Migration
Every caller in apps/ and packages/*/test, the scaffold loader template, the keel and keel-api skills, and the router and server READMEs move to the declaration form; golden-1 `*.server.ts` build `todosApi(new URL(url).origin)` and inspector's `loadInspect` uses `new URL(url).origin`. The positional `loader(output, fn)`/`action(input, fn)` form is gone: every caller, including the conformance fixtures and `packages/compiler/test/vite-project.test.ts`, uses the declaration form.

## Token impact
k.server 1162 -> 1408, k.router 1339 -> 1449; both <= 1,500.
