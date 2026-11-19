# k.guards: Guards
status: conformance-covered

**Guards.**
```ts
export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))
```
`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none). A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested). A guard's `Result` reaches no loader or action. On an API route a guard's denial is 403 `keel.denied` (k.api), and a loader or action that returns `err` of `keel.denied` is answered 403 in its own body (k.api Requests), so a `bearer` check may deny in either.

**Rules.** E1508 a guard's literal `redirect` route is under that guard, or (runtime) a guard redirect loop or a missing `redirect` param.

**Conformance.**
- A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs.
- A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`.
- A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`).
