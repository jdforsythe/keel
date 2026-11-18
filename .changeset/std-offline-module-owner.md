---
"@keel/std-offline": minor
---

The outbox sends through its module's service: `outbox(id, api, { module, limit, maxBytes })` requires `module`, and answers are read as `service({ module })` reads them, an undeclared 409 as JSON. `send(ctx, outbox, endpoint, input, { base, owner })` takes no origin, and each entry holds an `owner` in place of an `origin`. `drain(ctx, outbox, { owner })` posts only that owner's entries; every other owner's entry becomes `failed` with `offline.owner` and is never posted.

Migration: drop the origin argument of `send`, pass `owner` (the signed-in user's id, else `""`) to `send` and `{ owner }` to `drain`, give `outbox` the `module` that serves the endpoints, and declare each endpoint's `output` and `errors` as the route's `ok` value and its err's `error`, not the whole k.server answer. An entry stored with an `origin` or without an `owner` loads `failed` with `offline.owner` and is never sent; `resolve(..., 'theirs')` removes it.
