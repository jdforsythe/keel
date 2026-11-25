---
name: keel-data
description: "Durable Keel storage, app data (std-postgres), concurrent and offline writes, conflicts, live updates and workflows: topology storage, KEEL_DATABASE_URL, commitStores, transaction concurrent, keel.conflict 409, std-offline outbox, std-conflicts, std-channels, std-live, std-workflows; E1560, E1563, E1572, E2151-E2153, E2351-E2355, E1607, E2451-E2460, E2601, E2602, E2651, E2701"
---

# Data: storage, writes, live views, workflows

Signatures: `keel docs k.persist`, `k.data`, `k.sync`, `std.db`, `std.postgres`, `std.postgres-changes`, `std.contracts`, `std.offline`, `std.outbox-owner`, `std.conflicts`, `std.channels`, `std.live`, `std.workflows`.

## Durable storage

A `node` deployable's `storage` is `'file'`, `'sqlite'` or `'postgres'`; the app lists `@keel/std-db` in `dependencies` (E1572) and never imports it (E2151). `KEEL_DATABASE_URL`: SQLite takes a `file:` URL (default `file:/data/keel.sqlite`, Node 22.13 or later); Postgres requires a `postgres:` URL. A bad or missing value is E1560, an unopenable database E2153, a newer layout E2152. `keel check --base` reports a change that breaks stored data (E1563: make an added required field `.optional()`).

Outside a request (runners, jobs) use `commitStores(ctx, factory, fn)` from `@keel/server`, in `*.server.ts`; `fn` returns a `Result`, may run 3 times, and calls transactions only.

## App data

App data (k.data) goes in Postgres through `@keel/std-postgres`. `export const kitchenDb = database('kitchen.db')` (`modules/kitchen/kitchenDb.server.ts`) reads `modules/kitchen/migrations/*.sql` (`KEEL_APP_DIR`, else cwd) at its first call. A handler calls `kitchenDb(ctx).query(sql(Recipe)`select ... where id = ${id}`)`: a row schema per statement, each `${value}` a parameter. `one` of no row is `keel.notFound`; `run(sql(NoRows)...)` counts; `transaction(fn)` and each lone call are `serializable`, rerun 3 times, then `keel.conflict`: put a write and the read it uses in one `transaction`. `{ allow: 'write skew' | 'lost updates', reason: '<literal>' }` opts down (E2459, R2451); sim never shows its race. Migrations: `NNNN-<kebab>.sql`, forward only. `KEEL_POSTGRES_URL` is `postgres:` or `pglite:<folder>`; unset under `keel dev`, `.keel-dev/postgres`. Tests await `ready()` (`@keel/std-postgres/testing`) in `setupFiles`. Other stores: `register('notes.mongo', impls)`; names are literal `<module>.<lowerCamel>`, one file each (E1607, E2458). A library export `store(name)` that calls `register(name, ...)` takes the name at the app's call: `store('notes.main')` (E1607 at the argument). SQL `now()` is W2456.

## Concurrent writes

A store has a `head`. A write names the `base` head its writer read and a `key` making a retry commit once (`tx` takes `{ base, key }`). A transaction declares `concurrent`: `'reject'` (default) answers 409 `keel.conflict` with `data.head` when `base` is stale; `'rebase'` applies it to the current state, right when the payload holds nothing the writer read (a fresh id).

```ts
// modules/api/todos.schema.ts
import { s } from '@keel/schema'
import { channel } from '@keel/std-channels'

export const Item = s.object({ id: s.id('Todo'), title: s.string() })
export const TodoParams = s.object({})
export const todoChannel = channel('api.todos', { path: '/api/todos/events', params: TodoParams })
```
```ts
// modules/api/api.contract.ts
import { contract } from '@keel/router/contract'
import { s } from '@keel/schema'
import { Write } from '@keel/std-offline'
import { TodoParams, todoChannel } from './todos.schema.ts'

export const api = contract('api', {
  'api.todoEvents': { method: 'GET', path: '/api/todos/events', query: TodoParams, events: true, output: todoChannel.events },
  'api.addTodo': {
    method: 'POST', path: '/api/todos', body: s.object({ title: s.string({ min: 1 }), write: Write }), output: s.object({}),
  },
})
```
```ts
// modules/api/postTodo.server.ts
import { action } from '@keel/router'
import { err, ok, s } from '@keel/schema'
import { writeFor } from '@keel/std-offline'
import { store, transaction, tx } from '@keel/store'
import { api } from './api.contract.ts'
import { Item } from './todos.schema.ts'

export const todoStores = () => {
  const todos = store(s.object({ items: s.array(Item) }), { items: [] }, { id: 'api.todos' })
  const add = transaction(todos, 'api.add', Item, (state, p) => ({ items: [...state.items, p] }), { concurrent: 'rebase' })
  return { todos, add }
}

export const postTodo = action(api, 'api.addTodo', { stores: todoStores }, (body, { stores }, ctx) => {
  const w = writeFor(body.write, '')
  if (!w.ok) return err(w.error)
  const r = tx(stores.add, { id: ctx.random.id('Todo'), title: body.title }, w.value)
  return r.ok ? ok({}) : err(r.error)
})
```

`writeFor(write, owner)` is the first line of every action behind an outbox entry; `owner` is the module's function of `caller` giving the signed-in user's id (`''` for none). Another owner's write is 400 `offline.owner`, no user `offline.signin`; skipping it commits any owner's write.

## Offline writes

`outbox(id, contract)` (`@keel/std-offline`) queues the contract's API write entries in `ctx.storage` and sends them through its service; each body holds `write: Write`. `send` names an entry by its name after the module (`'addTodo'`); a GET, `events` or page id does not compile. `send` resolves `sent | queued | conflict | failed`; `drain(ctx, outbox, { owner })` in a scope flushes on each reconnect. `resolve(ctx, outbox, key, 'mine' | 'theirs')` settles a `conflict` or `failed` entry. `s.secret` in a body is E2651, an `events: true` entry E2652.

```ts
import type { Ctx } from '@keel/ctx'
import { outbox, resolve, send } from '@keel/std-offline'
import { api } from './api.contract.ts'

export const todoOutbox = outbox('todos.outbox', api)

export async function add(ctx: Ctx, title: string, head: number) {
  const r = await send(ctx, todoOutbox, 'addTodo', { body: { title } }, { base: head, owner: '' })
  if (r.state === 'conflict') await resolve(ctx, todoOutbox, 'entry-key', 'theirs')
  return r.state
}
```

`races(snapshot, stores)` or `findRaces(group, { user, serve, stores })` (`@keel/std-conflicts`) reports E2701 for a rebased write: make it `'reject'`, or stop its payload carrying a stale read.

## Live updates

Declare a channel in a `*.schema.ts` file and write its entries out in the contract with literal `method`, `path` and `events` (a spread or call is E1111): `query` is the channel's params const, `output: channel.events`, and a publish entry (a channel with a `message`) takes `body: channel.body` and `output: s.object({})`. `channelRoute(contract, channel, { id, publish?, stores?, follows?, member })` in a `*.server.ts` file (else E2601) returns `{ loader, action }`, which the binding names at those entries (an entry that differs from the channel's is E1515). `stores` returns each watched store as a direct value (`saved`); `member` decides who may open and publish. For std-postgres data, the write's transaction calls `await t.changed(channel, params)` and the route lists `follows: [db]`: each commit is `{ kind: 'changed' }` to every member stream of those params, on every replica, never for a rollback; params failing the channel's schema throw E2460. A server store's save reaches the streams of every replica when the storage has `watch`: `'postgres'` does (a `pg_notify` of store keys, never a value); `'file'` and `'sqlite'` do not, so a save is seen live only by its own process. A `message` reaches the member streams open in the serving process only, never resent (a stream closed, reopening or on another replica misses it): for what every replica's members must see, save a store in `stores` or `follows` a `changed`; a `message` is for a typing mark or ping. In a test, `createApp({ ctx: replica(a) })` (`@keel/ctx`) is a second replica. A `message` with `s.secret` is E2602. `live(ctx, origin, channel, params, { read, hydrate })` re-reads after each `saved` and `changed` into a `hydrate` transaction; `status()` is `connecting | live | offline | denied`; a 401, 403 or `keel.denied` read is `denied`, final; a signed-out member's stream closes `denied` at the next event. The lower-level `subscribe` (with `publish`) reports `connecting | open | offline | denied`. A live loader is an `async function*` yielding `ok(v)` on an `events: true` entry.

```ts
import { manifest } from '@keel/router'
import { channelRoute } from '@keel/std-channels/server'
import { api } from './api.contract.ts'
import { postTodo, todoStores } from './postTodo.server.ts'
import { todoChannel } from './todos.schema.ts'

const todoEvents = channelRoute(api, todoChannel, { id: 'api.todoEvents', stores: todoStores, member: () => true })
export const routes = manifest(api, { 'api.todoEvents': { loader: todoEvents.loader }, 'api.addTodo': { action: postTodo } })
```

A client view store changes only through a transaction. `live` runs in a scope, and its `hydrate` is listed in the component's `uses` (E1301):

```ts
import type { Ctx } from '@keel/ctx'
import { s } from '@keel/schema'
import { live } from '@keel/std-live'
import { store, transaction } from '@keel/store'
import { todoChannel } from './todos.schema.ts'

const copy = store(s.object({ titles: s.array(s.string()) }), { titles: [] }, { id: 'todos.copy' })
export const hydrate = transaction(copy, 'todos.hydrate', s.object({ titles: s.array(s.string()) }), (_old, next) => next)

export const follow = (ctx: Ctx, origin: string) =>
  live(ctx, origin, todoChannel, {}, { read: async () => ({ ok: true, value: { titles: [] } }), hydrate })
```

## Workflows

A workflow is a chart whose step states run a function and whose wait states time out; it needs `@keel/std-workflows`, `-jobs` and `-statecharts` in `deps` and a `node` deployable:

```ts
import { ok, s } from '@keel/schema'
import { queue } from '@keel/std-jobs'
import { chart } from '@keel/std-statecharts'
import { flows, workflow } from '@keel/std-workflows'

const removalChart = chart('api.removalChart', {
  data: s.object({}),
  start: {},
  events: { expired: s.object({}), undo: s.object({}), purged: s.object({}), purgeFailed: s.object({}) },
  initial: 'hidden',
  states: {
    hidden: { on: { expired: 'purging', undo: 'kept' } },
    purging: { on: { purged: 'removed', purgeFailed: 'kept' } },
    removed: { final: true }, kept: { final: true },
  },
})

export const removal = workflow('api.removal', {
  chart: removalChart,
  steps: { purging: { run: async () => ok({}), done: 'purged', failed: 'purgeFailed' } },
  waits: { hidden: { ms: 600_000, event: 'expired' } },
})
export const jobs = queue({ ...removal.jobs })
export const runners = [jobs, flows(jobs, [removal])]
```

`removal.server.ts` holds the workflow (E2351: elsewhere, or an id not prefixed by its module), `jobs.server.ts` the queue, `runners.server.ts` the runners (E2354). An action lists `removal.stores` in its `stores`, starts one with `tx(stores.removal.start, { id: ctx.random.id('Flow'), data })` and sends an event with `tx(stores.removal.events.undo, { id, payload: {} })`. A step runs at least once: pass `run(data, ctx, { signal, key })`'s `key` to its effect. A step killed mid-run runs again when its lease ends, `timeoutMs` (default 60,000) plus a second after it started, so `timeoutMs` also sets how long a crash stalls the run. E2352: a step or wait names no state or an event the state lacks; E2355: an event named `start`, `attempt` or `forget`; W2353: a step's effect is never undone.
