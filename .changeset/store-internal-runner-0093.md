---
"@keel/store": minor
"@keel/server": patch
---

`@keel/store/internal` (not public API) holds the server-state runner: `serverState(ctx)`, `openStores`, `saveStores`, `copyOf`, `inOrder`, `savedOf` and their types; `@keel/store` depends on `@keel/ctx`. `@keel/server` runs its `stores` factories through it, and the in-process copy of saved snapshots is one per `ctx.storage`, so two `createApp`s on one ctx read each other's saves and a stale save is 409 `keel.conflict` (rfc:0093).
