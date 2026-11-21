---
"@keel/router": minor
---

`@keel/router/internal` exports `createRouterWith(routes, opts, state?)`: the client router with a `ServerState` from `@keel/store/internal` that runs loaders and actions naming `stores`, each loader run and each submit one request (an action's `ok` saves; a stale read is `keel.conflict`; `err` or a throw saves nothing). The public `createRouter` is unchanged and still answers `stores` with `keel.unexpected` (rfc:0093).
