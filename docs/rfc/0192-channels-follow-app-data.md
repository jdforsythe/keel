# RFC 0192: std.channels and std.postgres: a channel follows changes an app data commit names

Status: implemented (ADR-0214, D98). Amends std.channels, std.live and std.postgres; no kernel section changes. From `apps/household` (walkthrough finding L7-3).

## Decisions
- D1: a write names the channel it changes. Inside a `db(ctx).transaction`, `t.changed(channel, params)` records a change of that channel instance; std-postgres delivers it only after the transaction commits, and never for a rollback or a rerun that did not commit. The channel is the topic: no second name is declared for it.
- D2: a channel route lists the data capabilities it follows, `follows: [shoppingDb]`, beside or instead of `stores`. A followed change reaches each open member stream of that channel and params as `{ kind: 'changed' }`, and `live` re-reads after it as after `saved`.
- D3: across processes by the database itself. On a `postgres:` URL, `changed` is `pg_notify` inside the transaction, which Postgres delivers to every listening connection after commit; each process holds one `LISTEN` connection per URL. On PGlite and under sim the same statement runs on the one in-process database. The three stores share one delivery rule.
- D4: the seam is structural and stays in the stdlib. std-channels accepts any capability accessor whose object has `follow(channel, key, on)`; std-postgres is the one that has it today. The kernel gains nothing, and no stdlib package imports another for it.
- D5: events carry no row data and no params. The stream already names its channel and params; `changed` says only that the page should re-read through its own guarded loader (std.channels Privacy stands).
- D6: a lost listen connection ends each stream that follows it, as a drop. `subscribe` reopens with its backoff, and the reopen's `reset` makes the page re-read, so nothing missed while the connection was down is lost.
- D7: server-store `saved` and `message` delivery stay in the serving process (ADR-0081). This RFC carries app data changes across replicas and nothing else.

## Problem
k.data keeps app data out of the kernel: the household's shopping list lives in Postgres through `@keel/std-postgres`. std.channels sends `saved` "after each save of a store `stores` creates", and a Postgres commit is no store save, so a channel over the list has nothing to watch. `apps/household` invents one:

- `changeStores.ts`: a server store `shopping.changes` holding `{ n }` and a `bump` transaction.
- `Changes.schema.ts`: its schema.
- `postItem.server.ts`, `toggleItem.server.ts`, `deleteItem.server.ts`: each action declares `stores: changeStores` and calls `tx(stores.bump, {})` after its Postgres transaction commits.
- `listEvents.server.ts`: `channelRoute(..., { stores: changeStores, member })`.

Four faults follow from it.
1. A write that forgets the bump leaves every open page stale, and nothing reports it.
2. Each action now makes two commits Keel does not join, against k.data: "Saving stores and writing app data are two commits Keel does not join: an action does one of them." Two members adding at once both commit to Postgres, then both save `shopping.changes`; the second save is 409 `keel.conflict` (k.server Server state), so a member sees "That change did not apply" for a change that did.
3. A bump on one replica reaches only the streams open in that process (std.channels: "Delivery reaches the streams open in the serving process"). With two replicas of the `node` deployable behind one balancer, a member whose stream is held by the other replica sees nothing until a reload.
4. The counter counts nothing the app needs; it exists to cause a save.

## Proposal
### What the author writes
Before (household today), per write action:
```ts
export const postItem = action(shopping, 'shopping.add', { stores: changeStores }, async (body, { stores }, ctx) => {
  const items = await changeList(ctx, (list) => addTo(list, { id: ctx.random.id('Item'), name: body.name }))
  if (!items.ok) return err(items.error)
  const told = tx(stores.bump, {})
  return told.ok ? ok({ items: items.value }) : err(told.error)
})
```
plus `changeStores.ts`, `Changes.schema.ts` and `stores: changeStores` on the channel route.

After: the one transaction that writes the list names the channel it changes.
```ts
// changeList.server.ts, last statement of the transaction's fn
const told = await t.changed(listChannel, {})
if (!told.ok) return told
return ok(after)
```
```ts
// postItem.server.ts
export const postItem = action(shopping, 'shopping.add', {}, async (body, _args, ctx) => {
  const items = await changeList(ctx, (list) => addTo(list, { id: ctx.random.id('Item'), name: body.name }))
  return items.ok ? ok({ items: items.value }) : err(items.error)
})
```
```ts
// listEvents.server.ts
export const listEvents = channelRoute(shopping, listChannel, {
  id: 'shopping.events',
  follows: [shoppingDb],
  member: ({ user }) => user !== '',
})
```
`changeStores.ts` and `Changes.schema.ts` are deleted; the three actions lose `stores` and the bump. The page (`ShoppingList.tsx`) does not change: `live` re-reads on `changed` as it does on `saved`.

### std.postgres: `changed` and `follow`
- `changed(channel, params)` on `tx` and on the database object: `Promise<Result<null, E>>`. `channel` is any value with `name` and a `params` schema (a std.channels `channel`; std-postgres imports no type from std-channels). `params` is parsed by `channel.params` (a failure throws E2460) and keyed as its canonical JSON (keys sorted). On `tx` it records the change in the transaction: it is delivered once the transaction commits, once per channel and key however many times `fn` called it, and never when the transaction rolls back or `fn` runs again after a serialization failure. On the database object it is its own transaction, delivered when it commits. A failure is the statement's (`keel.unreachable`). Its plan step (k.sim) is a statement's: none on `tx`, one alone.
- Wire form, Postgres and PGlite: `select pg_notify('keel_changes', $1)` with `$1` the JSON text `{"d":<capability>,"c":<channel name>,"k":<key>}`. A payload over 7,900 bytes throws E2460 before any statement runs. Postgres delivers a notification only after its transaction commits, in commit order, and drops duplicates within one transaction.
- `follow(channel, key, on)` on the database object: calls `on({ kind: 'changed' })` for each committed change of that capability, channel name and key, on any process using the same URL, and `on({ kind: 'lost' })` once if delivery stops; returns a function that stops it. It resolves once the process is listening, so a change committed after it resolves is never missed.
- Connections: on a `postgres:` URL, each process opens one listening connection per URL at its first `follow`, outside the pool of 10, and closes it when the last follow stops; a lost one is `lost` to every follow on it, and the next `follow` opens it again. On a `pglite:` folder and under sim, the one in-process database delivers to its own follows. Under sim, delivery happens when the committing step settles, in step order, with no timer.
- No error, log line or diagnostic holds `params` or a key.

### std.channels: `follows` and `changed`
- `channelRoute(api, channel, { id, publish?, stores?, follows?, member })`. `follows` lists data capability accessors (k.data) whose object has `follow`; an entry whose object has none is a type error. `stores` becomes optional; a route may have either, both or neither.
- `ChannelEvent` gains `{ kind: 'changed' }`: after each committed change a followed capability reports for this channel and the stream's params, to every open member stream of them, with `member` re-run first as after a save (false: `closed` `denied`). `changed` and `saved` are delivered in the order they arrive at the process.
- At open, the stream follows each entry before it yields `reset`; an entry not listening within 5,000 ms on `ctx.clock`, or a `lost` report, ends the stream with no `closed` event, as a drop, so `subscribe` reopens with its backoff (std.channels Client).
- Delivery: a followed change reaches the member streams open in every process whose capability shares the database; `saved` and `message` reach the streams open in the serving process.
- Privacy gains: "`changed` names nothing: neither the capability nor the params nor a row."

### std.live
`read` runs after each `reset`, `saved` and `changed` event. The rest of std.live stands.

### What does not change
The kernel (k.data, k.store, k.persist, k.server); a channel declaration; `subscribe`'s status set; std.channels caps (`perCaller`, `perAnonymous`, `maxStreams`, counted per process); store `saved` delivery; a channel `message`.

## Alternatives
- **Status quo, with the counter-store pattern documented in keel-data.** Rejected: it keeps faults 1 to 4. The 409 on a committed write (fault 2) is a correctness bug the docs cannot fix, and a store save never leaves its process (fault 3).
- **A separate topic declaration**, `topic(shoppingDb, 'shopping.list', { params })` that writes raise and channels follow. Rejected: a second name for what the channel already names, a params mapping between topic and channel, and one more file per live list. A write that changes two channels calls `changed` twice, which reads as what it does.
- **Channels following a table declaratively**, `follows: table('items')`. Rejected: Keel would install a trigger per table (DDL in the app's database, which k.data leaves to the app), could not tell which channel params a row belongs to without a mapping query per row, and would fire for every column of every write, the household's `seq` updates included.
- **A kernel signal primitive any data battery can raise**, `signal(ctx, name, key)` in `@keel/server`. Rejected: the kernel gains a publish and subscribe surface (PRINCIPLES 8) and still needs a transport across replicas, which only the battery has; a signal raised outside the data transaction fires on a rollback or misses on a crash between commit and signal, which is fault 2 again.
- **std-channels holding a broker of its own** (Redis, or Keel storage's Postgres through std-db). Rejected for this RFC: it adds a service to every replicated deployment and is still raised after the commit, not in it. It remains the route for store `saved` across replicas (D7).

## Spec diff
Not applied; applied in the implementing commit under `rfc:0192`.
- **std.postgres**, API: the `changed` and `follow` bullets above after `transaction`. Modes: the listening connection sentence after "a pool of at most 10 per URL per process", and "under sim, delivery happens when the committing step settles, in step order". Rules: "E2460 a `changed` whose `params` fail the channel's schema or whose payload exceeds 7,900 bytes (throws)". Extension points: "`follow` is the std.channels follow seam."
- **std.channels**, Serve: `stores?`, `follows?` in the signature; the `changed` event in the event list; `member` "after each save of its stores and each followed change"; the open-before-`reset` and drop sentences; the Delivery sentence above replacing "Delivery reaches the streams open in the serving process." Privacy: the `changed` sentence.
- **std.live**, API: "after each `reset`, `saved` and `changed` event".
- **Status**: std.channels and std.live `implemented`, std.postgres stays `implemented`, in each section and `spec/00-map.md`.
- **Ledger**: the clauses below at `none`.
- **Skills**: keel-data Live updates gains the `follows` and `t.changed` form for std-postgres data, and E2460 in its description; keel-architecture Reach names `changed`.

## Conformance
By the `conformance-writer`, under `rfc:0192`, from the spec text alone.
- std.postgres, under sim, on a `pglite:` folder and on Postgres 17 in CI: a `follow` started before a `transaction` that calls `changed(ch, { b: 'x' })` twice and commits gets one `changed`; one whose `fn` returns `err` gets none; under sim a plan `conflict`, `none` that calls `changed` in each run gets one.
- std.postgres: a `follow` of `{ b: 'x' }` gets nothing for a change of `{ b: 'y' }`, another channel name or another capability on the same URL.
- std.postgres, Postgres 17: two processes on one URL, a `follow` in process B and a committed `changed` in process A; B's `on` gets `changed`, and a read in B started after it sees A's rows.
- std.postgres: params failing the channel's schema and a payload over 7,900 bytes each throw E2460 and run no statement.
- std.postgres, Postgres 17: terminating the listening connection's backend reports `lost` to each open follow; the next `follow` opens a new one and gets the next change.
- std.channels: with `follows: [db]`, an open member stream gets `reset`, then `{ kind: 'changed' }` after a committed `changed` of its channel and params, and nothing for other params; a stream for which `member` is false at that point gets `closed` `denied`.
- std.channels: a `lost` report ends each following stream with no `closed` event; under sim, `subscribe` reopens 1 s later and the new stream starts with `reset`.
- std.channels: no `changed` event holds a capability name, a param or a row value.
- std.live: a `changed` event during one read causes exactly one more read; with callers A and B on one sim server whose route follows a database, a write by A that calls `changed` is in B's hydrated store after B's next read.

## Build
- `packages/std-postgres/src/server/`: `changed` on the transaction and database objects, the listener per URL with its follows, the PGlite and sim delivery; E2460.
- `packages/std-channels/src/server/channelRoute.ts`: `follows`, `stores` optional, `changed` in the per-stream chain beside `saved`; `ChannelEvent` and the events schema gain `changed`.
- `packages/std-live/src/`: `changed` starts a read.
- `apps/household/modules/shopping/`: the after form above; `changeStores.ts` and `Changes.schema.ts` deleted; `test/live.test.ts` gains a test that two `createApp`s on one Postgres 17 URL deliver a write on one to a stream on the other (CI only, as the std.postgres Postgres 17 clauses).
- Size: std-channels and std-live client bundles gain one event kind, under 0.1 kB.

## Migration
None: unreleased.

## Token impact
std.postgres gains about 230 tokens, std.channels about 150, std.live about 5; each stays under the section budget (2,350).

## For the operator
- What an app author writes changes: a live list over std-postgres data is `t.changed(channel, params)` in the write's transaction and `follows: [db]` on the channel route. The invented counter store goes away from `apps/household` and from the docs.
- Store `saved` and `message` delivery across replicas stay open (D7, ADR-0081). A replicated `node` deployable with live server stores still sees only its own process's saves; that needs its own RFC (a std-db notify on save is the likely shape), and I recommend a backlog line for it.
- The vision holds: Keel still owns no app data and the kernel names no database. The seam (`follow` on a capability's object) is open to any data battery, so a Mongo change stream or a Redis capability plugs in the same way.
