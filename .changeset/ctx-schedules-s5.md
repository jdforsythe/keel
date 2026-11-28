---
"@keel/ctx": minor
---

Schedules (k.sim): `createCtx({ mode: 'sim', seed, schedule })` takes a `Schedule` (exported schema, with `NetStep`): the n-th fetch waits its `delay` on the sim clock and meets its `fault` (`none`, `drop`, `lost`, `unavailable`), the n-th storage call `ok` or `fail`, offline windows take the net offline and back, and `plans[name]` reaches a capability registered with `plan` through its sim factory's `{ seed, plan }`. `SimClock.next()` returns the earliest pending `after` deadline. A schedule on a real or shell ctx, one that fails `Schedule`, or a plan step that fails its schema throws E1604.
