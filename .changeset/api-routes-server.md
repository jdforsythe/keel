---
"@keel/server": minor
---

An API route (`api: true`) is answered as a runtime request whatever `accept` says: `{ id, results }` for GET with a loader, 405 with `allow` listing its action methods without one, the action's `Result` as JSON for a write (never 303), and 403 `keel.denied` for a guard denial without following any `redirect`. `createApp` throws E1511 for a `client` or `static` deployable serving an API route. A 405's `allow` lists the route's action methods for every method.
