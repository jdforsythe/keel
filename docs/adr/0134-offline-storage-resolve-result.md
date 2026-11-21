# ADR-0134: std.offline: `offline.storage` and the answer to `resolve(..., 'mine')` (RFC 0112)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** `send` and the flush already failed an entry with `offline.storage` when a write to `ctx.storage` rejected, but std.offline named only `offline.full`, so the code was the implementer's choice and nothing tested it. `resolve(..., 'mine')` re-queued the entry and flushed in the background, resolving `true`; the caller could not see whether the re-send was sent, refused again, failed or still queued, and golden-1's editor chart watched the outbox to learn it.

**Decision.**
- D1: `OutboxResult`'s `failed` carries an `ApiError`, `offline.full` or `offline.storage`. A rejected storage write in `send`, a flush or a `'mine'` `resolve` leaves the entry `failed` with `offline.storage` in memory and releases the flush.
- D2: `resolve(..., 'mine')` resolves the re-sent entry's `OutboxResult`, as `send` does, or `false` when nothing applied; `'theirs'` resolves `boolean`.
- D3: one `resolve`, overloaded by the literal resolution, with a wide overload for a `Resolution`-typed argument.

**Alternatives.**
- One wide return type for both resolutions: every literal caller narrows.
- A `dropped` state for `'theirs'`: a state `send` never returns.
- A second function for `'mine'`: two names for one choice.

**Consequences.**
- A caller of `'mine'` gets the answer to the re-send in the same call.
- `resolve(..., 'mine')` returns later than before: once the re-send answers, or the flush stops.
- `offline.storage` is held by a conformance case under a sim storage schedule.
