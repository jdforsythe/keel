---
"@keel/std-channels": patch
"@keel/std-offline": patch
---

`subscribe` starts its stream after the current tick, so a page may subscribe while it renders. A failed membership re-check after a save ends the stream `closed` `denied`; messages wait for a pending re-check; `member` runs before the caps; the inbox frees its abort listener after each wait. The outbox reads an app route's answer as its `Result`: a 2xx gives the value, a 502 `keel.unreachable` keeps the entry `queued`, a 409 gives the conflict's head. A module-level `outbox(...)` creates its store on first use. The outbox loads its stored entries once per ctx, within `limit` and `maxBytes`, before any send; a storage write that fails ends the entry `failed` and releases the flush; a stored entry naming no endpoint of the api is `failed`.
