---
"@keel/testing": minor
---

`renderRoute` runs loaders and actions naming `stores` over the render ctx's `ctx.storage` through the server's runner (`serverState` from `@keel/store/internal`), each navigation or submit one request: an action's `ok` saves and reports `save`, a stale read is `keel.conflict`, `err` or a throw saves nothing. A harness and a `createApp` on one ctx share the saved copy (rfc:0093).
