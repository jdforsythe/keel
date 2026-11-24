# RFC 0214: k.persist and std.channels: a store save reaches the live streams of every replica

Status: implemented (ADR-0236) by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.persist (Storage, a Watch paragraph, Conformance), k.sim (Replicas, Conformance), k.deploy (Storage, two sentences), std.db (API, On disk, Conformance), std.channels (Serve, Conformance), std.live (Conformance), the map and the std index. From backlog 1034.

## Decisions
- D1: the storage driver announces commits, as std-postgres's `changed` does for app data. k.persist gains one optional part of the storage contract, `watch(on)`: it reports each `true` commit another storage object made to the same data, naming the `keel.store.` keys it stored and never a value. No bus, no broker, no new service.
- D2: std.db's `postgres` driver provides `watch` over `LISTEN`/`NOTIFY`: `pg_notify` inside the commit's transaction, so a report follows only a commit, in commit order. `sqlite`, `fileStorage` and `localStorage` provide none and stay correct for one process.
- D3: std.channels reads `watch`. A process holds one watch for its streams of routes with `stores`; a `committed` report makes the route read the key (the read `member` already shares) and deliver `saved` with the stored head. The kernel `save` event stays what this process saved, so std.workflows and std.sessions are unchanged.
- D4: a subscriber may rely on: per stream and store, `saved` heads strictly rise; after `reset`, each save of a store in `stores`, by any process, is followed by a `saved` of that store with that head or a later one, or by the stream's end. Heads may be coalesced; none comes twice. A lost listen ends the stream as a drop, so `subscribe` reopens and `reset` re-reads.
- D5: `message` stays in the serving process. Carrying it across replicas means a notification holding the message, which may hold personal data, or storing messages, which std.channels Privacy refuses.
- D6: no diagnostic. `topology.ts` declares no replica count; how many processes run is a deploy-time fact. k.deploy and std.channels say which storage carries saves across processes.
- D7: tests show two replicas with `replica(ctx)` from `@keel/ctx` (k.sim Replicas): a sim ctx sharing clock, random, net, schedule, capabilities and storage data, with its own storage object and its own observers. One `createApp` serves on each.

## Problem
A server store's save is reported as a `save` event on the saving process's ctx (k.sync Saves), and std.channels turns it into `saved` for the streams open in that process. With two replicas of a `node` deployable on `storage: 'postgres'` behind one balancer, a save on replica A reaches no stream held by replica B: a member on B sees the change only after a reload. App data already crosses (RFC 0192: `t.changed` and `follows`, over `LISTEN`/`NOTIFY` in std-postgres); Keel's own stores do not. The storage already crosses: both replicas `read` and `commit` through one database, and the 409 rule holds across them (k.persist Server saves). Only the announcement is missing.

A second gap shows in tests. k.persist says two `createApp`s on one sim ctx behave as two processes sharing one storage, and for conflicts they do; but they share one ctx's observers too, so std.channels' per-ctx hub delivers A's save to B's streams. A sim test passes for a case production gets wrong.

## Proposal
### k.persist: `watch`
`watch(on): Promise<() => void>`, optional on a storage. `on({ kind: 'committed', keys })` after each `commit` resolving `true` through another storage object on the same data that stored a value at a `keel.store.` key: those keys, sorted, never a value, one report per commit in commit order (a driver may split a long list across consecutive reports). `set`, condition-only writes and commits storing no store key report nothing. `on({ kind: 'lost' })` once when delivery stops. The promise resolves once listening and rejects when it cannot. A storage nothing watches does no work for it.

Only store keys are named: store ids are literals in app code (k.server), so a report carries no personal data, and jobs, schedules and workflows commits, which no stream reads, cost no notification.

### std.db: `postgres` watches
Opening takes a token, the opening transaction's `pg_current_xact_id()`, unique per open. A `true` commit storing a store key runs `pg_notify('keel_storage', '{"o":<token>,"k":[keys]}')` in its transaction, split to keep each payload at most 7,900 bytes. One listening connection per process, outside the pool, `application_name` `keel-storage-<pid>`, opened at the first `watch` and closed at the last stop; a notification with the process's own token is dropped, since the process reported that save itself. A lost connection is `lost` to each watch. `sqlite` has no `watch`: SQLite has no cross-process notification, and polling would cost every one-process app.

### std.channels: `saved` from any process
- At open, a route with `stores` on a storage with `watch` is watching before `reset`, with the 5,000 ms bound and the drop on `lost` that `follows` has.
- A `committed` report: the route reads the named key in the read `member` shares, parses the snapshot's `head`, and delivers `saved { store, head }` to member streams as a local save would, `member` and `currentUser()` judged as today.
- One filter for both paths: a process delivers a `saved` of a store only when its head is above the last it delivered for that store. That orders local and remote events into one rising sequence per store, drops a duplicate and folds a burst.
- `message` reaches the serving process's streams only, said plainly in Serve.

### What a subscriber may rely on
Per stream and store, heads strictly rise. After `reset`, each save of a store in `stores`, by any process on the same data, is followed on that stream by a `saved` of that store with that head or a later one, or by the stream's end, after which `subscribe` reopens and `reset` makes `live` re-read. That is at-least-once in what a page needs: it never misses the latest state and re-reads at most once per delivered head. No intermediate head is promised; std.live re-reads the latest anyway.

### What each app pays
- One process, no durable storage (`'file'`, the default): nothing. `fileStorage` has no `watch`; std.channels makes no call; no byte reaches a client (the client bundle is unchanged).
- `'sqlite'`: nothing; saves stay per process, as k.deploy now says.
- `'postgres'`: one `pg_notify` statement in each store commit's transaction. A process with no open stream of a route with `stores` holds no listening connection.
- Identity: none. `watch` names no caller, and a stream still judges `member` and `currentUser()` per delivery.

### Non-durable stores
A save through a storage without `watch` is seen live only by its own process. That is every storage but `postgres`; `'file'` is one process by k.deploy, so two replicas on it diverge in data, not only in live updates. No diagnostic: the topology does not declare replicas (D6).

### Tests: `replica(ctx)`
k.sim Replicas: `replica(ctx)` of a sim ctx shares clock, random, net, schedule and capability implementations (so std-postgres's sim database and its `follow` are shared too), and has its own storage object on the same data and its own observers (`net` reaches both). Off sim it throws E1604, as `schedule` does. A test of two replicas:
```ts
const a = createCtx({ mode: 'sim', seed: 1 })
const A = createApp({ ctx: a, routes })
const B = createApp({ ctx: replica(a), routes })
const ann = await renderRoute('board.home', { app: A, routes: () => import('./routes.ts') })
const bob = await renderRoute('board.home', { app: B, routes: () => import('./routes.ts') })
await ann.fire('board.add', { type: 'click' })
await bob.settle()   // bob's live view re-read after A's save reached B's stream
```

## Alternatives
- **A bus of std-channels' own** (Redis, or a table polled by std-channels). Rejected: a new service or a poll for every replicated app, raised after the commit rather than in it; the storage already orders commits.
- **The kernel reporting a remote `save` event.** Rejected: std.workflows and std.sessions count or act on `save` as this process's work; a remote `save` would double their counts. The watch stays read by std.channels.
- **Heads in the notification.** Rejected: a driver stores opaque values and does not know heads, and the route reads the key anyway for `member`.
- **`watch` on sqlite by polling `data_version`.** Rejected: a timer in every SQLite app for a case (several processes on one host) k.deploy does not promise.
- **A `replicas` field in `topology.ts` and a warning.** Rejected: a topology concept for a deploy-time count, and the warning would fire on `'sqlite'` apps running one process.
- **`message` across replicas through the notification.** Rejected (D5).

## Spec diff
Applied in this commit.
- k.persist (to `implemented`): Storage's sim sentence names replicas; Watch paragraph; four clauses.
- k.sim (to `implemented`): Replicas paragraph; two clauses.
- k.deploy (stays `conformance-covered`): `'sqlite'` and `'postgres'` say what a live stream sees. No clause.
- std.db (stays `proposed`): `postgres` `watch`; On disk names the notification; five clauses.
- std.channels (to `implemented`): Serve's open and delivery sentences; six clauses.
- std.live (to `implemented`): one clause.
- Map and std index: k.persist, k.sim, std.channels, std.live read `implemented`.
- No diagnostic, glossary term or section is added. Ledger rows come from the orchestrator's regeneration.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/ctx/conformance/storage-watch.test.ts`: k.persist's four new clauses (sim storage and `replica`).
- `packages/ctx/conformance/sim-replica.test.ts`: k.sim's first new clause.
- `packages/server/conformance/replica-saves.test.ts`: k.sim's second (two `createApp`s).
- `packages/std-db/conformance/postgres-watch.test.ts`: std.db's five (Postgres 17 in CI, as the existing Postgres 17 clauses).
- `packages/std-channels/conformance/saved-across-replicas.test.ts`: std.channels' six.
- `packages/std-live/conformance/live-replicas.test.ts`: std.live's one.

## Migration
None: unreleased.

## Token impact
Measured as `tooling/budgets.mjs` counts: k.persist 1,343 to 1,893 tokens; k.sim 1,424 to 1,784; std.channels 2,179 to 2,759; std.db 1,077 to 1,520; std.live 1,197 to 1,261; k.deploy 1,606 to 1,639; each under the 3,400 section budget (`node tooling/budgets.mjs` ok). The map shrinks from 1,427 to 1,423 of 1,430; no budget moves. `keel explain E1604` gains `replica` in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the 18 clauses. 3. Build:
- `packages/ctx`: `KeyValueStorage` gains optional `watch`; the sim storage keeps its data apart from its handle, with `watch` across handles; `replica(ctx)` exported from `@keel/ctx`, its observer set its own, its capability map the parent's; E1604 off sim.
- `packages/std-db/src/postgres/postgres.ts`: the token, `pg_notify` in `write`, the listener with its watches.
- `packages/std-channels/src/server/internal/`: the hub's watch beside its `save` observer, the last-head filter, open before `reset`, `lost` as a drop.
- Docs: keel-data skill Live updates (replicas on `'postgres'`; `message` per process), `@keel/ctx`, `@keel/std-db`, `@keel/std-channels` READMEs, changesets, `tasks/BACKLOG.md` 1034.

## For the operator
1. **`message` stays per process.** A replicated app's channel messages reach only the publisher's replica. Recommended: yes for now; carrying messages needs a broker or stored messages, each a Privacy change. I recommend a backlog line.
2. **No warning for replicas on a store that does not cross.** Recommended: yes; the topology declares no replica count, and k.deploy now says what `'file'` and `'sqlite'` carry.
3. **`replica` lives in `@keel/ctx`, not `@keel/testing`.** It makes a ctx, and `@keel/testing` re-exports nothing; tests import it beside `createCtx`.
4. **Every `'postgres'` store commit runs `pg_notify`**, listened to or not. Recommended: yes; one statement in a transaction that already takes locks and upserts.
