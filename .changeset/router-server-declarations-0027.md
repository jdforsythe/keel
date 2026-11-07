---
"@keel/router": minor
"@keel/server": minor
---

k.router/k.server (RFC 0027): `loader({ output, params?, search? }, fn)` and `action({ input, params? }, fn)` infer `fn`'s `params`/`search` from the declared schemas, which must be the route's own values (`manifest` throws E1507); `fn` also gets `url`, the absolute request URL (server: the request; client-only router: resolved against the document). The positional `loader(output, fn)`/`action(input, fn)` form is deprecated.
