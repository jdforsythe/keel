# ADR-0136: a std.live read is bounded at 30 s and cancelled when given up (RFC 0114)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** `live` runs one read at a time and cleared its pending flag only when the read settled. A `read` that never settled kept the flag set: later `saved` events ran no read, the store never refreshed and `status()` stayed `live`.

**Decision.**
- D1: a read is pending until it settles or 30 s pass on `ctx.clock`, whichever is first; a fixed constant, equal to the backoff cap.
- D2: a read not settled within 30 s counts as failed: `status()` is `connecting`, and it enters the existing 1 s to 30 s backoff, or runs at the next event.
- D3: a read commits nothing after its 30 s, as it commits nothing after a read started later.
- D4: `read` receives an `AbortSignal` as its second argument, `read(ctx, signal)`, aborted when its 30 s pass while it is pending and when the scope is disposed while it is pending. A `read` that takes only `ctx` stays valid and stays bounded.

**Alternatives.**
- The signal alone, with no bound: a read that ignores it would still freeze the view.
- The signal as an options field, `read(ctx, { signal })`: as compatible, but unlike `ctx.clock.after(ms, signal)`.
- A `timeout` option: a second way to write the same view.

**Consequences.**
- A stalled read no longer freezes a live view; it recovers within 31 s of the stall.
- A read that takes over 30 s and then succeeds is discarded and retried.
- A read that forwards `signal` to its fetch closes the request it gives up, so a hanging backend no longer piles up open connections.
