# k.guards: Guards
status: conformance-covered

**Guards.**
```ts
export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))
```
`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none). A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested). A guard's `Result` reaches no loader or action.

**Carried params.** For each page whose chain holds a page or layout guard with `redirect`, every field of the `redirect` route's `params` must be a field of the page's `params` whose node fits the target's: the same node, or one of the same type with the same options (an `id` of the same brand), or one holding only values the target accepts (an `enum` or `literal` each of whose values the target's node parses; a `string`, `number` or `int` whose `min` and `max` lie within the target's of the same type, or an `int` within a `number` target's, an absent bound unbounded; a `number` never fits an `int`). A missing field or one that does not fit makes `manifest` throw E1508 naming the page, the `redirect` route and the field, and `routeTable` for a chain it joins across modules, so `keel build` reports it (k.compiler Build-time evaluation) before any denial. On an API route a guard's denial is 403 `keel.denied` (k.api), and a loader or action that returns `err` of `keel.denied` is answered 403 in its own body (k.api Requests), so a `bearer` check may deny in either.

**Rules.** E1508 a guard's literal `redirect` route is under that guard, or (route table) a carried param missing or not fitting, or (runtime) a guard redirect loop.

**Conformance.**
- A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs.
- A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`.
- A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`).
- `manifest` throws E1508 naming the page, the `redirect` route and the field when a guarded page lacks a field of the `redirect` route's `params`, or carries `s.id('User')` to `s.id('Recipe')`, `s.enum(['a', 'b', 'c'])` to `s.enum(['a', 'b'])` or `s.string()` to `s.string({ max: 8 })`; it throws none for the same schema, `s.enum(['a'])` to `s.enum(['a', 'b'])`, `s.literal('a')` to `s.string()` or `s.int({ min: 1 })` to `s.int()`; `routeTable` throws E1508 for a page of one module under another module's guarded layout.
