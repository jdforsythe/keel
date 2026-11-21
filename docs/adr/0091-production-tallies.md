# ADR-0091: production evidence is a server-side tally of committed transactions (RFC 0082)

**Status:** accepted (2026-11-10), user decisions D1 and D3, under the WORKFLOW RFC defaults 3, 4 and 5.

**Context.** The ledger's `monitored` rung is production only and never emitted by the kernel, and no stdlib package emitted it. std.sessions uploads a session only on its first error, so nothing counted what ran without one.

**Decision.** std.monitor, part of `@keel/std-sessions` at `./monitor` (Node only). `monitor` is a k.topology `Runner`: after each `save` event (k.sync) it reads the saved store's snapshot from `ctx.storage` and counts each new log entry by name, and every 60,000 ms of `ctx.clock` merges the counts into `sessions.tally` (`{ v, from, to, tx }`). `monitorRoutes` serves it at `GET /sessions/tally` behind the existing `sessions.reader` guard. `keel session monitor <url>` writes `.keel/monitored.json`, which k.ledger reads as `monitored` evidence. E2009 refuses either in a non-`node` deployable; E2010 marks a tally URL that fails. For the S5 exit the tally comes from a production build of golden-1 on a local port, driven by Playwright (D3).

**Alternatives.**
- Uploading clean sessions, rejected: they carry payload values and hundreds of events, and a tally needs names and counts.
- Client-side tallies, rejected: golden-1's writes commit in server stores.
- A k.server event per committed entry, rejected: the `save` event plus the stored snapshot meet the need without a kernel change.
- A separate `@keel/std-monitor` package, rejected: it would repeat std.sessions' reader guard, `readers` config, token and command.

**Consequences.**
- Only transaction names and counts leave the server; no payload, caller or state is read into a tally.
- Refused writes, client stores and other server instances are not counted.
- A hosted deployment's tally committed to the repository would publish its traffic counts; the S5 exit publishes only the local drill's.
