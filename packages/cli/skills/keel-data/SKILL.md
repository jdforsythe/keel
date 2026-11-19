---
name: keel-data
description: "Durable Keel storage, concurrent and offline writes, conflicts, live updates and workflows: topology storage, KEEL_DATABASE_URL, commitStores, transaction concurrent, keel.conflict 409, std-offline outbox, std-conflicts, std-channels, std-live, std-workflows; E1560, E1563, E1572, E1605, E2151-E2153, E2351-E2355, E2601, E2602, E2651, E2701"
---

# Data: storage, writes, live views, workflows

Signatures: `keel docs k.persist`, `k.sync`, `std.db`, `std.offline`, `std.outbox-owner`, `std.conflicts`, `std.channels`, `std.live`, `std.workflows`. A code's section: `keel docs --for <code>`.

## Durable storage

A `node` deployable's `storage` is `'file'`, `'sqlite'` or `'postgres'`, and the app lists `@keel/std-db` in `dependencies` (E1572). App code never imports `@keel/std-db` (E2151). `KEEL_DATABASE_URL`: SQLite takes a `file:` URL (default `file:/data/keel.sqlite`, Node 22.13 or later); Postgres requires a `postgres:` URL. A bad or missing value is E1560, an unopenable database E2153, a newer layout E2152. `keel check --base` reports a change that breaks stored data (E1563: make an added required field `.optional()`).

Outside a request (runners, jobs) change stores with `commitStores(ctx, factory, fn)` from `@keel/server`, in `*.server.ts`. `fn` returns a `Result`, may run up to 3 times, and calls transactions only. `drivers` on a sim ctx is E1605.

## Concurrent writes

Each store has a `head`. A write names the `base` head its writer read and a `key` that makes a retry commit once. A transaction declares `concurrent`: `'reject'` (default) answers 409 `keel.conflict` with `data.head` when `base` is stale; `'rebase'` applies the write to the current state, right when the payload holds nothing the writer read (a fresh id). `tx` takes `{ base, key }`.

```ts
import { action } from '@keel/router'
import { err, ok, s } from '@keel/schema'
import { Write, writeFor } from '@keel/std-offline'
import { store, transaction, tx } from '@keel/store'

const Item = s.object({ id: s.id('Todo'), title: s.string() })

export const todoStores = () => {
  const todos = store(s.object({ items: s.array(Item) }), { items: [] }, { id: 'api.todos' })
  const add = transaction(todos, 'api.add', Item, (state, p) => ({ items: [...state.items, p] }), {
    concurrent: 'rebase',
  })
  return { todos, add }
}

export const postTodo = action(
  { input: s.object({ title: s.string({ min: 1 }), write: Write }), output: s.object({}), stores: todoStores },
  (input, { stores }, ctx) => {
    const w = writeFor(input.write, '')
    if (!w.ok) return err(w.error)
    const r = tx(stores.add, { id: ctx.random.id('Todo'), title: input.title }, w.value)
    return r.ok ? ok({}) : err(r.error)
  },
)
```

`writeFor(write, owner)` is the first line of every action behind an outbox endpoint: `owner` is the module's own function of `caller` giving the signed-in user's id, `''` for no one. Another owner's write is 400 `offline.owner`, no user `offline.signin`; skipping it commits a write of any owner.

## Offline writes

`outbox(id, endpoints, { module })` (`@keel/std-offline`) queues writes in `ctx.storage` and sends them through the module's service. Each body holds `write: Write`. `send` resolves `sent | queued | conflict | failed`; `drain` in a scope flushes again on each reconnect; `owner` is the signed-in user's id, else `''`. `resolve(ctx, outbox, key, 'mine' | 'theirs')` settles a `conflict` or `failed` entry. An `s.secret` in a body is E2651, an `events: true` endpoint E2652.

```ts
import type { Ctx } from '@keel/ctx'
import { s } from '@keel/schema'
import { endpoints } from '@keel/services'
import { Write, drain, outbox, resolve, send } from '@keel/std-offline'

const api = endpoints({
  addTodo: {
    method: 'POST',
    path: '/api/todos',
    body: s.object({ title: s.string({ min: 1 }), write: Write }),
    output: s.object({}),
    errors: { 409: s.json() },
  },
})
export const todoOutbox = outbox('todos.outbox', api, { module: 'api' })

export async function addOffline(ctx: Ctx, title: string, head: number) {
  const r = await send(ctx, todoOutbox, 'addTodo', { body: { title } }, { base: head, owner: '' })
  if (r.state === 'conflict') await resolve(ctx, todoOutbox, 'entry-key', 'theirs')
  return r.state
}
export const flush = (ctx: Ctx) => drain(ctx, todoOutbox, { owner: '' })
```

`@keel/std-conflicts`: `races(snapshot, stores)` or `findRaces(group, { user, serve, stores })` reports E2701 for a rebased write: make its transaction `'reject'`, or stop its payload carrying a value read from a stale copy.

## Live updates

Declare a channel in a shared file; serve it in `*.server.ts` (else E2601); follow it in a scope. `stores` returns each watched store as a direct value (a workflow's is `removal.stores(ctx).store`). `member` decides who may open and publish. A `message` holding `s.secret` is E2602. `live` re-reads after each save into `hydrate`; `status()` is `connecting | live | offline | denied`. A live loader is an `async function*` yielding `ok(v)`, read through an `events: true` endpoint.

```ts
import type { Ctx } from '@keel/ctx'
import { s } from '@keel/schema'
import { channel } from '@keel/std-channels'
import { channelRoute } from '@keel/std-channels/server'
import { live } from '@keel/std-live'
import { store, transaction } from '@keel/store'
import { todoStores } from './todos.ts'

export const todoChannel = channel('api.todos', { path: '/api/todos/events', params: s.object({}) })

export const todoEvents = channelRoute(todoChannel, {
  id: 'api.todoEvents',
  stores: todoStores,
  member: () => true,
})

const copy = store(s.object({ titles: s.array(s.string()) }), { titles: [] }, { id: 'todos.copy' })
export const hydrate = transaction(copy, 'todos.hydrate', s.object({ titles: s.array(s.string()) }), (_old, next) => next)

export const follow = (ctx: Ctx, origin: string) =>
  live(ctx, origin, todoChannel, {}, { read: async () => ({ ok: true, value: { titles: [] } }), hydrate })
```

List the route in the manifest as `{ api: true, path, loader }` and pass its `actions` to `routes.actions`. `subscribe` and `publish` are the lower level.

## Workflows

A workflow is a chart whose step states run a function and whose wait states time out. It needs `@keel/std-workflows`, `@keel/std-jobs` and `@keel/std-statecharts` in `deps`, a `node` deployable:

```ts
import { ok, s } from '@keel/schema'
import { queue } from '@keel/std-jobs'
import { chart } from '@keel/std-statecharts'
import { flows, workflow } from '@keel/std-workflows'

const Failure = s.object({ code: s.string() })
const removalChart = chart('api.removalChart', {
  data: s.object({}),
  start: {},
  events: { expired: s.object({}), undo: s.object({}), purged: s.object({}), purgeFailed: Failure },
  initial: 'hidden',
  states: {
    hidden: { on: { expired: 'purging', undo: 'kept' } },
    purging: { on: { purged: 'removed', purgeFailed: 'kept' } },
    removed: { final: true },
    kept: { final: true },
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

`removal.server.ts` holds the workflow (E2351: elsewhere, or an id not prefixed by its module), `jobs.server.ts` the queue, `runners.server.ts` the runners (E2354 when missing). An action starts one with `tx(stores.removal.start, { id: ctx.random.id('Flow'), data })` and lists `removal.stores` in its `stores`; `tx(stores.removal.events.undo, { id, payload: {} })` sends an event. A step runs at least once: `run(data, ctx, { signal, key })` passes `key` to its effect so a repeat is safe. E2352 a step or wait names no state or an event the state lacks; E2355 an event named `start`, `attempt` or `forget`; W2353 a step's effect is never undone.
