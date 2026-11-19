# ADR-0170: std.offline: a drain's scope drops its retry, stream endpoints are refused, ctxs keep their entries apart (RFC 0148)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** A module-level outbox outlives the page scope that drains it, so its retry timer posted after that scope ended. An `events: true` endpoint made the flush throw and left its entry `sending` across reloads. One outbox used from two ctxs shared one flush and let one ctx's owner fail the other's entries.

**Decision.**
- D1: ending `drain`'s scope drops its ctx's pending retry.
- D2: `outbox` throws E2652 for an `events: true` endpoint.
- D3: each ctx holds the entries it added or loaded; its owner change, flush, retry, `resolve` and storage writes reach only those. The store shows them all.

**Alternatives.**
- A second ctx on one outbox throws: breaks module-level outboxes under tests.
- One store per ctx: `Outbox` reads take no ctx.
- A check rule for E2652: the throw at declaration already fails closed.

**Consequences.**
- A page that leaves stops posting; the next `send` or `drain` starts again.
- Tests and servers that meet one module-level outbox from many ctxs see no cross-ctx failures or storage writes.
- Two tabs over one storage key still overwrite each other's stored list.
