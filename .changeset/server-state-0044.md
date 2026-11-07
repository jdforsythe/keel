---
"@keel/server": minor
"@keel/store": minor
"@keel/router": minor
---

RFC 0044: per-request server stores. `loader({ ..., stores })` and `action({ ..., stores })` name a factory `(ctx) => S`; `fn` gets `stores` (this request's instance, restored from `ctx.storage` `keel.store.<id>`) and `caller` (the `keel-caller` token, `""` when none). An action's `ok` saves changed stores, or answers 409 `keel.conflict` when another request saved one since; `err` or a throw saves nothing. Record the caller with `tx(t, p, { meta: { caller } })` and undo with `undoWhere`. Removed: `undoOwn`, `canUndoOwn`, `createApp({ expose })`, `Transaction.payload` (use `schema`). The client router answers a loader or action naming `stores` with `keel.unexpected`.
