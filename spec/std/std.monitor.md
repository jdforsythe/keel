# std.monitor: Production tallies
status: proposed

**Module.** Part of `@keel/std-sessions`, subpath `./monitor` (Node only), under the module `sessions` and its config (`readers`). It counts, on a running server, how many times each server-store transaction commits, and gives the count to the ledger as `monitored` evidence (k.ledger). It records names and counts only.

**Count.** `monitor` is a `Runner` (k.topology) that a module lists in `runners.server.ts`. Its `run(ctx, signal)` observes the app's `ctx`: after each `{ kind: 'save', store, head }` (k.sync) it reads `keel.store.<store>` from `ctx.storage` and adds one run per log entry whose `id` is above the last head it counted for that store, keyed by the entry's `name`; at its first save of a store it counts the entries above the head it saw when `run` started, else from 0. Every 60,000 ms on `ctx.clock`, and once when `signal` aborts, it merges the counts into `ctx.storage` key `sessions.tally`:
```ts
type Tally = { v: 1; from: number; to: number; tx: { [name: string]: number } }
```
`from` is the clock time of the first merge and `to` of the latest. A store folded past the entries not yet counted (more than `logLimit` commits between two saves) is counted from its kept log; the gap is not estimated.

**Read.** `monitorRoutes` holds the API route (k.api) `sessions.tally` (`GET /sessions/tally`), listed by the serving module: guard `sessions.reader` (a `caller` in `readers`, else 403 `keel.denied`), loader output `Tally` from `ctx.storage`, `{ v: 1, from: 0, to: 0, tx: {} }` when none.

**Command** (k.cli `session`). `monitor <url> [--out f]` fetches `<url>/sessions/tally` with cookie `KEEL_SESSIONS_TOKEN`, as `ingest` does, and writes `.keel/monitored.json` (default `--out`): `{ v: 1, origin, from, to, tx }`, `origin` the URL's origin, keys sorted. It prints one `session.monitor` record `{ kind, origin, transactions, runs, file }`; compact `ok session monitor 7 transactions, 312 runs -> .keel/monitored.json`. A non-2xx answer is E2010 and writes nothing.

**Privacy.** Only transaction names, which are declared in source, and counts leave the server: no payload, caller, state, entry time or request detail is read into the tally. `sessions.tally` is behind the reader guard, and the file holds what the route returned.

**Rules.** E2009 `monitor` in the runners, or `monitorRoutes` in the routes, of a non-`node` deployable · E2010 `session monitor`: the tally URL is unreachable, not 2xx, or not a `Tally`.

**Conformance.**
- Under sim, after three saves of a store whose actions committed `api.addTodo` twice and `api.toggleTodo` once, and one clock advance of 60,000 ms, `sessions.tally` holds `tx` `{ 'api.addTodo': 2, 'api.toggleTodo': 1 }`.
- Entries committed before `run` started are not counted, and each entry is counted once across saves and merges.
- Aborting `signal` merges the counts not yet stored, and `run` resolves.
- No value of a payload, a caller hash or a store state appears in `sessions.tally` or in the written file.
- A caller outside `readers` gets 403 `keel.denied` from `sessions.tally`; a reader gets the `Tally`.
- `keel session monitor` against a served tally writes `.keel/monitored.json` that k.ledger reads; against an unreachable URL it reports E2010 and writes nothing.
- E2009 fires on a fixture and not on its clean twin.
