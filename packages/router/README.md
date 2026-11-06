# @keel/router

**Spec:** k.router · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `manifest(routes)` · `href(id, params?, search?) -> Href` · `loader(output, fn)` · `action(input, fn)` · `guard(name, { redirect }, fn)` · `createRouter(manifest, { ctx, history }) -> { navigate(href, { replace? }), route, App, dispose }`; `route.get()` is `{ id, params, search, pending }` · `Form(props)` · `routesArtifact(manifest)` · `browserHistory()`. Types in `src/index.ts`.
- **Invariants:** `manifest` registers routes process-wide (same id replaces) and throws `code` E1502-E1506 (unknown layout: at `createRouter`). `href` is deterministic, omits absent optionals, sorts search keys, throws for unknown ids. Static beats `:param`; trailing slash is canonicalized. Bad params: `keel.notFound` in the nearest `errorElement` alone, no guard or loader. Guards outermost first; `keel.denied` redirects with `?next=`. Loaders start together after guards; the previous page stays until they settle; an `err` renders the nearest `errorElement` under its layouts. `ok(null)` reruns each chain loader once, no re-render; `ok(href)` pushes. After `navigate`: focus `main`, scroll top; pop restores the URL's saved scroll.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/runtime-dom` (`boundary`, `cond`), `@keel/ctx` (types).
- **Rungs:** conformance; properties (seed 1337): href/match round-trip over generated manifests, static beats param, trailing slash.

## Extension points

`FormHandle` (`pending`, `values`, `validate`, `onResult`): `<Form form>` calls `validate()` (an `err` stops the submit), sets `pending`, runs the action from FormData, then `onResult(result)`. Implemented by `@keel/forms`. `RouterHistory`: any `{ push, replace, current, onPop }`.

## Unsafe

count: 2 (`unsafe/toHref.ts`: brand a built path; `unsafe/narrowRoute.ts`: typed route union over the untyped computed)
