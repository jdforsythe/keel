# k.prefix: Implied path prefix
status: proposed

**Purpose.** An app serves a second value of a leading path param (a second locale) without moving the first value's URLs. Only the URL codec changes: the param is present and typed in `params` on every URL.

**Declaration.** Once, in the param's schema: `s.enum(values, { pathDefault: d })` (k.schema), `d` one of `values` (else it throws).
```ts
export const AppLocale = s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })  // AppLocale.schema.ts
'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams, ... }       // routes.ts
routes.href('recipes.show', { locale: 'en-US', recipeId })   // '/recipes/<id>'
routes.href('recipes.show', { locale: 'de-DE', recipeId })   // '/de-DE/recipes/<id>'
```
A route is prefixed when its path's first segment is `:p` and its params field `p` has a `pathDefault`; `p` is the prefix param. Without `pathDefault` a leading param is ordinary, and every URL carries it.

**Write.** `routes.href`, guard redirects and everything built on them leave out the segment of `d` (`/:locale` with `d` is `/`) and write any other value as usual.

**Parse.** After the trailing-slash redirect (k.router), in order:
1. A first segment equal to a value of `p` other than `d`: the rest of the path matches the prefixed routes, with `p` that value.
2. A first segment equal to `d`: a 308 redirect to the path without it, search kept, as a trailing slash is; the client router replaces the history entry. Each page has one URL.
3. Otherwise the whole path matches the unprefixed routes and the prefixed routes with `p` set to `d`; static beats `:param` as in k.router. No route left is 404.

`params`, the served route in `#k-state`, the `nav` event (k.ctx) and the harness carry `p` on every URL, so resume, session replay and tests pin it through params; it is also the document's `lang` (k.head). `matchHref` of a step-2 href gives its target's match.

**Rules.** E1509 (k.router block), from `manifest` and from `keel check` over a deployable's route table: a static first segment equal to a value of a prefix param; a route whose first segment is another param; a route whose path is a prefixed route's path without the prefix; two prefix params in one table; a `pathDefault` param that is not first in its path. Fix: prepend `/:<p>` to the route's `path` (its params then need the field, E1503).

**Conformance.**
- With `p` of `s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })` and route `x.show` at `/:p/items/:id`, `routes.href('x.show', { p: 'en-US', id: '7' })` is `/items/7` and with `de-DE` `/de-DE/items/7`; for every generated params value, `navigate(routes.href('x.show', v))` makes `route().params` equal `v`.
- `/items/7` matches `x.show` with `p` `en-US` and `/de-DE/items/7` with `de-DE`; `/fr-FR/items/7` is 404; without `pathDefault`, `/items/7` is 404 and `/en-US/items/7` matches.
- A GET of `/en-US/items/7?q=1` answers 308 with `Location: /items/7?q=1`; a client navigation to it ends at `/items/7` with `p` `en-US` and adds one history entry.
- `routes.href('x.show', { id: '7' })` and `routes.href('x.show', { p: 'fr-FR', id: '7' })` do not compile.
- A guard on a prefixed route that redirects to a prefixed route keeps `p`: `/de-DE/...` redirects under `/de-DE/`, an unprefixed URL to an unprefixed one.
- Beside `x.show`, each of `/de-DE/about`, `/:slug` and `/items/:id` is E1509, the fix applied leaves no E1509, and without `pathDefault` none of them is E1509.
- `s.enum(['en-US'], { pathDefault: 'fr-FR' })` throws.
