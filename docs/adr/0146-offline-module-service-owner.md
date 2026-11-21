# ADR-0146: std.offline: the outbox sends through `service({ module })`, and each entry has an owner (RFC 0120)

**Status:** accepted (user, 2026-11-17).

**Context.** The outbox sent each entry to an `origin` stored in the entry, through a `base` service over a derived map, and read answers by hand with a fallback that accepted two answer shapes. A stored origin was used unchecked, so a tampered entry could be posted anywhere, and entries had no owner, so the next user of a browser could post the previous user's queued writes under their own caller cookie.

**Decision.**
- D1: `outbox(id, api, { module, limit, maxBytes })` sends through `service({ module, schema: api })` and reads answers as `service({ module })` does; an undeclared 409 is read as a KeelError. `send(ctx, outbox, endpoint, input, { base, owner })` takes no origin, and entries hold no `origin`.
- D2: `send` and `drain` require `owner`, a string the app gives (the signed-in user's id, else `""`); each entry holds its `send`'s owner. A flush posts only entries of the owner last given on the ctx.
- D3: when the owner on a ctx changes, and when the stored outbox loads, every entry of another owner that is not `failed` is stored `failed` with `offline.owner`. A `failed` entry is never posted; `'theirs'` removes it.
- D4: a stored entry with an `origin` or no `owner` loads `failed` with `offline.owner` and owner `""`, and is never posted.

**Alternatives.**
- The owner from the caller cookie: `httpOnly`, unreadable by the client, and unavailable offline.
- One owner given to `outbox`: declared before anyone signs in.
- Keeping other owners' entries untouched, or dropping them silently: the first carries one user's writes through another's session; the second loses writes without a trace.
- Rewriting stored origins to the module's address: posts writes whose owner nobody knows.

**Consequences.**
- A stored entry goes only to its endpoint on the module, and only for its owner.
- The outbox reads answers in one way, the k.services way; golden-1's outputs and error schemas describe the route's value and error, not the whole answer.
- Writes queued before the upgrade are shown `failed` and are not sent.
- Every `send` and `drain` call names an owner; apps without sign-in pass `""`.
