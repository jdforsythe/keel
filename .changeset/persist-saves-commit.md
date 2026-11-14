---
"@keel/store": minor
"@keel/server": minor
"@keel/check": minor
---

A request restores a factory's stores from one `ctx.storage.read`, and an action's save is one `ctx.storage.commit` whose `expect`s are the values restored and whose conditions are the opened unchanged keys, so the read-set rule and saves of several stores hold for every process sharing one storage driver. The in-process copy only spares parsing. `commitStores(ctx, factory, fn)` from `@keel/server` is that path for runners and jobs, with up to 3 runs on a refused commit and `save` events; E1551 also reports `commitStores` outside `*.server.ts`.
