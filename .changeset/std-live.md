---
"@keel/std-live": minor
---

`@keel/std-live`: `live(ctx, origin, channel, params, { read, hydrate })` keeps a client store current through `subscribe`, one read at a time with events during a read coalesced into one more, retries a failed read on `ctx.clock` (1 s doubling to 30 s) or at the next event, and returns a `LiveStatus` signal read (`connecting`, `live`, `offline`, `denied`).
