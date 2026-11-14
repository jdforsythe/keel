# k.guards: Guards
status: conformance-covered

**Guards.**
```ts
export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))
```
`caller` is k.server's `caller` (`''` if none or client-only). A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested).

**Rules.** E1508 a guard's literal `redirect` route is under that guard, or (runtime) a guard redirect loop or a missing `redirect` param.

**Conformance.**
- A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs.
- A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`.
- A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`).
