# ADR-0149: std-offline storage faults (RFC 0127)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** A rejected `ctx.storage` write left the outbox entry `failed` in memory and `queued` in storage, so a reload posted a write the page was told had failed. The flush's single `catch` labeled any throw `offline.storage`. A write that never settled held the flush for ever. `offline.owner`'s fixed message was unstated, and `'theirs'` let a storage error's thrown text reach the caller. std.offline was at 1,499 of 1,500 tokens.

**Decision.**
- D1: after a rejected write the outbox is written once more, best effort, in `send`, a flush and `resolve` (`'theirs'` included). If that write is rejected too, storage keeps the state of the write that landed last, and `drain` loads it as written.
- D2: no stored state marks a doubtful `queued` entry, so `load` does not guess. A stored entry is posted only under its own key and the server store commits it at most once (k.sync); a second `send` after `failed` has a new key and can commit the write again. The spec states that limit.
- D3: a write not settled 10 s after it began, on `ctx.clock`, counts as rejected. The bound is reversible.
- D4: only those storage faults become `offline.storage`. Any other throw in a flush releases it, leaves the entries as they are, resolves the waiting calls `queued` and is rethrown unhandled.
- D5: an `offline.owner` err is `{ code, message: <outbox id>, data: {} }`, as `offline.storage` is.
- D6: with `'theirs'`, a rejected write still removes the entry in memory and `resolve` resolves `true`.
- D7: the text lives in a new section, `std.outbox`; std.offline keeps a pointer.

**Alternatives.**
- The limit stated with no second write: leaves transient faults open.
- A marker write before each risky write: one more write to a failing storage.
- A new `offline.unexpected` code: names a broken ctx with a new code and still fails the entry.
- Skipping a held entry: breaks posting in order.
- `false` or `failed` from `'theirs'`: `false` means "no such entry"; `failed` changes the result type.

**Consequences.**
- `@keel/std-offline` grows about 100 bytes gzip against 3,066 of 3,072: the builder trims or the operator raises the budget.
- A ctx that throws from a method now shows as an unhandled rejection.
- A page told `failed` under a storage that rejects every write can still commit the write twice if the user sends it again.
