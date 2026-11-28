# ADR-0245: std.channels: a channel message stays in the process that serves its publish (RFC 0223)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** A store's save reaches the live streams of every replica through the storage's `watch` (RFC 0214), and a followed `changed` through std-postgres. A channel `message` reaches only the streams open in the process that served its publish. The spec said so in one sentence, without saying what an author uses instead, where a message falls against saves on a stream, or what a reconnecting stream gets.

**Decision.**
- A `message` reaches the member streams open in the process that serves its publish and no other: no `watch`, notification, broker or stored record carries it, under sim and on every storage.
- What the members on every replica must see is a save of a store in `stores` or a followed `changed`; a `message` is for what may reach only some members.
- On a stream, a publish served after a save of a store in `stores` resolved in the same process reaches each stream after that save's `saved` or `reset`, if any.
- A message is never resent: a stream closed, reopening or on another replica when it is published never gets it.
- No diagnostic: `topology.ts` declares no replica count.
- A transport for messages across replicas stays in `tasks/FUTURE.md`.

**Alternatives.**
- A message in a `pg_notify` beside the store keys: members' text through the database's queue and logs, a 7,900-byte limit on every app, and `watch` no longer about storage.
- A stored record or a broker: stored messages are what Privacy refuses; a broker is a new service per replicated app.
- A warning for `message` on `'postgres'`; dropping `message`.

**Consequences.** No app pays anything: no request, statement or byte is added. In a replicated deployment a message reaches only the members on the publisher's replica, and k.deploy says so. std.channels reads `implemented` until its two new clauses are covered.
