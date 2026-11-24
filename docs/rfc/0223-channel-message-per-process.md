# RFC 0223: std.channels: a channel message stays in the process that serves its publish

Status: accepted (ADR-0245) by the orchestrator on 2026-11-24, for the operator to confirm. Amends std.channels (Serve, Conformance), k.deploy (Storage, one sentence), the std index. From backlog 1082.

## Decisions
- D1: a `message` reaches the member streams open in the process that serves its publish, and no other. No `watch`, notification, broker or stored record carries it. This is the promise for one process and for many, under sim and on every storage.
- D2: what the members on every replica must see is a save of a store in `stores` (k.persist Watch carries it) or, for app data, a `changed` the route `follows` (std.postgres-changes carries it). Each member then re-reads through its own loader. A `message` is for what may reach only some members: a typing mark, a cursor, a ping.
- D3: on a stream, a `message` keeps its place among the process's deliveries: a publish served after a save of a store in `stores` resolved in the same process reaches each stream after that save's `saved` or `reset`, if the stream gets one. Deliveries to one stream already keep their order; this says where a message falls.
- D4: a message is never resent. A stream closed, reopening (after a drop, a `lost` watch or follow, or going offline) or open on another replica when the message is published never gets it; the next stream starts with `reset`, as for everything missed while closed.
- D5: no diagnostic. `topology.ts` declares no replica count (RFC 0214 D6), so a rule cannot tell a replicated `'postgres'` app from a one-process one, and a warning on every channel with `message` on `'postgres'` would have no fix but dropping the feature.
- D6: left undecided on purpose: a transport for messages across replicas. `tasks/FUTURE.md` holds it until an app needs one.

## Problem
RFC 0214 made a store's save reach the live streams of every replica through the storage's `watch`, and left `message` in the serving process. With two replicas of a `node` deployable behind one balancer, a member streaming from replica B never sees a `message` published through replica A. The spec says so in one sentence of Serve, but does not say what an author uses instead, where a message falls against saves on a stream, or what a reconnecting stream gets. Without those, an author building on `message` finds the gap only in production.

## Proposal
### The promise
A `message` is delivered to the member streams of the same channel and params open in the serving process, the publisher's included, each after `member` and the `currentUser()` check, as today. It is not carried anywhere else and never resent.

### Why not carry it
Carrying a message to another replica means one of:
- **A transient notification**, a `pg_notify` holding the message on std.db's `postgres`. A message holds what members typed, possibly personal data; std.channels Privacy says it is never stored or logged. A notification sits in the server's notification queue, and a server logging statements logs its parameters. It also needs a size bound (7,900 bytes) that the one-process app would not otherwise have, a new optional part of the k.persist storage contract that is not storage, and a sim transport to keep sim and Postgres alike.
- **A stored record** read by the other replicas: storing messages is what Privacy refuses, and it adds a commit per message.
- **A broker** (Redis or a hosted bus): a new service for every replicated app.

Each adds machinery for a case the saves already cover: an event every member must see is state, and state is a save.

### What each app pays
Nothing. One process, `'file'`, `'sqlite'` and `'postgres'` alike: no request, byte or statement is added. The client bundle is unchanged.

### Sim and Postgres
The same test passes in both: under sim, `createApp` B on `replica(a)` gets none of A's messages (the existing clause), and on Postgres no message leaves its process.

## Alternatives
- **A message in a `pg_notify` beside the store keys** (a `{ kind: 'message' }` report of `watch`, payload at most 7,900 bytes, lost during a reconnect). Rejected: personal data through the database's queue and logs, a size limit on every app, and `watch` stops being about storage.
- **A diagnostic** for a channel with `message` on a `'postgres'` deployable. Rejected (D5).
- **Dropping `message`.** Rejected: one-process apps and per-replica hints (typing, presence pings) use it, and no feature is cut.

## Spec diff
Applied in this commit.
- std.channels (to `implemented`): Serve's message sentence becomes three: where a message goes and that it is never resent; its place against saves on a stream; what to use for what every replica must see. Two clauses.
- k.deploy (stays `conformance-covered`): `'postgres'` says a live stream sees only its own replica's channel messages. No clause.
- Std index: std.channels reads `implemented`.
- No diagnostic, glossary term or section is added. The map is unchanged. Ledger rows come from the orchestrator's regeneration.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/std-channels/conformance/message-per-process.test.ts`: std.channels' two new clauses (the order of `saved` then `message`; no `message` for a stream opened after the publish).

## Migration
None: unreleased.

## Token impact
Measured by `tooling/budgets.mjs`: std.channels stays under its 3,100-token budget; k.deploy grows by one clause of a sentence. No budget moves (`node tooling/budgets.mjs` ok).

## Build plan
1. This commit: RFC, ADR, spec text, `tasks/FUTURE.md`. 2. `conformance-writer`: the two clauses. 3. Build: `packages/std-channels/src/server/channelRoute.ts` if a clause fails (a publish already queues behind a stream's pending deliveries); docs: the keel-data skill's Live updates (what to use instead of a message across replicas), `packages/std-channels/README.md`, a changeset, `tasks/BACKLOG.md` 1082.

## For the operator
1. **A message stays in its process; Keel promises nothing more for replicas.** Recommended: yes. What every member must see is a save or a followed change, which already cross replicas; a message is for hints that may reach only some.
   Alternative: carry a message in a `pg_notify` on `'postgres'` (at most 7,900 bytes, lost while a replica reconnects); it sends members' text through the database's queue and logs, which Privacy now refuses.
2. **No warning for `message` on a replicated deployable.** Recommended: yes; the topology does not know the replica count.
