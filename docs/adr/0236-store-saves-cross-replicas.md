# ADR-0236: k.persist and std.channels: a store save reaches the live streams of every replica (RFC 0214)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** A server store's save is a `save` event on the saving process's ctx, and std.channels delivers `saved` only to the streams open there. Two replicas of a `node` deployable on `storage: 'postgres'` share the data and the 409 rule, but a save on one never reaches a live page held by the other. App data already crosses through std-postgres's `changed` and `follow`. Two `createApp`s on one sim ctx share its observers, so sim tests could not show the gap.

**Decision.**
- k.persist: a storage may have `watch(on)`, its one optional part. It reports each `true` commit another storage object made to the same data as `{ kind: 'committed', keys }`, the `keel.store.` keys stored, sorted, never a value, in commit order; `lost` once when delivery stops; it resolves once listening.
- std.db `postgres` provides it: `pg_notify('keel_storage', {"o":token,"k":keys})` inside the commit's transaction, payloads at most 7,900 bytes, one listening connection per process opened at the first watch, its own token dropped. `sqlite`, `fileStorage` and `localStorage` provide none.
- std.channels watches once per process while a stream of a route with `stores` is open, waits for it before `reset` (5,000 ms, `lost` a drop), reads the named key in the read `member` shares and delivers `saved` with the stored head. A process delivers a store's `saved` only above the last head it delivered, so per stream heads strictly rise; after `reset` each save is followed by a `saved` with that head or a later one, or by the stream's end.
- The kernel `save` event stays this process's; `message` stays in the serving process; no diagnostic, since `topology.ts` declares no replica count.
- k.sim: `replica(ctx)` (`@keel/ctx`) is a sim ctx sharing clock, random, net, schedule, capabilities and storage data, with its own storage object and observers; off sim, E1604. Two replicas in a test are a `createApp` on each.

**Alternatives.**
- A broker of std-channels' own or a polled table: a new service or a timer per replicated app, raised after the commit.
- A remote `save` kernel event: std.workflows and std.sessions would count other processes' saves.
- Heads in the notification: a driver stores opaque values; the route reads the key for `member` anyway.
- Polling SQLite, a `replicas` field with a warning, `message` in the notification (personal data).

**Consequences.** A replicated `'postgres'` app's live pages see every replica's saves; each store commit there runs one `pg_notify`. A one-process app on `'file'` or `'sqlite'` pays nothing. Channel messages of a replicated app reach only the publisher's replica. k.persist, k.sim, std.channels and std.live read `implemented` until their new clauses are covered.
