# @keel/router

**Spec:** k.router · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `manifest(routes)` · `href(id, params?, search?) -> Href` · `loader({ output, params?, search? }, fn)` · `action({ input, params? }, fn)` (`fn` gets `params`/`search` as `Infer` of the declared schemas and the absolute `url`; the positional form is deprecated, RFC 0027) · `guard(name, { redirect }, fn)` · `createRouter(manifest, { ctx, history }) -> { navigate(href, { replace? }), route, App, dispose }`; `route.get()` is `{ id, params, search, pending }` · `Form(props)` · `routesArtifact(manifest)` · `browserHistory()`. Types in `src/index.ts`.
- **Invariants:** each `manifest` validates only its own entries (throws `code` E1502-E1507; E1507: a loader or action schema that is not the route's own value) and owns its table; manifests never interact. Free `href(id)` resolves in the newest manifest declaring `id`; a router, its `Form`s and redirects use only their own manifest. `href` is deterministic, omits absent optionals, sorts search keys, throws for unknown ids. Static beats `:param`; trailing slash is canonicalized. Bad params: `keel.notFound` in the nearest `errorElement`, inside its layouts only if none has a loader or guard; no guard or loader runs. Guards outermost first; `keel.denied` redirects with `?next=`. Loaders start together after guards; the previous page stays until they settle; an `err` renders the nearest `errorElement` under its layouts. `ok(null)` reruns each chain loader once, no re-render; `ok(href)` pushes. After `navigate`: focus `main`, scroll top; pop restores the URL's saved scroll.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/runtime-dom` (`boundary`, `cond`), `@keel/ctx` (types).
- **Rungs:** conformance; properties (seed 1337): href/match round-trip over generated manifests, static beats param, trailing slash.

## Extension points

`FormHandle` (`setPending`, `values`, `validate`, `onResult`): `<Form form>` calls `validate()` (an `err` stops the submit), `setPending(true)`, runs the action from FormData, `setPending(false)`, then `onResult(result)`. `Form` finds its router through the owner scope chain (the `App` scope); outside a router it is a native form. Implemented by `@keel/forms`. `RouterHistory`: any `{ push, replace, current, onPop }`.

## Unsafe

count: 0
