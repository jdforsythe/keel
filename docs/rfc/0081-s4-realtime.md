# RFC 0081: S4 Realtime: live views, channels, outbox and races

Status: draft. Stage design RFC for S4 (`tasks/PROGRAM.md`, task 0310). Implementation waits for the S2 and S3 pushes; the server event stream this design builds on is RFC 0080's (S3) and is stated here as a requirement, not designed a second time. It applies WORKFLOW RFC defaults 1 (four kernel gaps get kernel changes, K1 to K4, specified in one new kernel section, k.sync), 2 (one push transport, one write path, one read path: golden-1's `syncAfter` is replaced by std.live, not kept beside it), 3 (writes stay actions, reads stay loaders, std-sessions replay is extended to groups, the exit proof extends the existing `golden-1-api` eval), 4 (a push carries no data; channel messages exist only where a schema declares them; outbox entries and groups hold no secret), 5 (`member`, `stores`, `save` events and channel config stay on the server), 6 (the `concurrent` policy and the write key are enforced inside `tx`, and E2601, E2602 and E2651 refuse what prose would otherwise ask for) and 7 (`@keel/store` is re-based; no threshold is lowered). Open questions 1 to 3 are the escalations the defaults require.

## Problem
S4 must let several users work on one server's data at once: a view that stays current when someone else writes, named channels between users, writes made while disconnected that land on reconnect, and a defined outcome when two users' writes conflict. Its exit proof is a session captured from two users that replays deterministically and reports a planted race. These gaps block it (evidence from the code as of this RFC):

1. **No store version.** The server's conflict check compares the identity of an in-process cache object (`packages/server/src/internal/saveStores.ts`: `sv.saved.get(o.key) !== o.from`); nothing in `ctx.storage` or a snapshot says how far a store has moved. A client cannot say which state it acted on, so a write computed from a stale copy lands silently. In golden-1 today, user B's edit form opened before user A renamed the todo posts the old title back over A's rename, with 200.
2. **No per-transaction policy.** The only concurrency rule is the read-set 409 for requests that overlap inside the server. Whether a stale write should be refused or applied is a property of the transaction (a toggle can apply, a full-field edit should not), and nothing declares it.
3. **No idempotency.** A POST whose response was lost is applied again when retried. An offline queue that resends on reconnect needs a key the store recognizes.
4. **No push and no after-save signal.** `createApp` serves one `hono.all('*')` handler and buffers every document (`new Response(html)`); no SSE, WebSocket or stream code exists in `packages/*/src`. An action cannot publish after its save, since the save runs after the action returns and can still be 409. golden-1 re-reads only after its own writes (`syncAfter.ts`).
5. **No connectivity.** `ctx.net` has no online state, the sim net cannot go offline (`simNet.ts` routes or 404s), and `navigator.onLine` in app code would be an ambient read.
6. **Replay is one user.** `replayRun` drives one sim ctx with no server in the loop; client stores are module-global and every harness renders into one `document`, so two users cannot share a process (`packages/testing/src/openHarness.ts`).
7. **A re-run resource flashes.** A `resource` whose fetcher re-runs goes back to `loading` (`packages/reactive/src/resource.ts:55`), so `Match` would rebuild a ready subtree, and lose focus, on every push.

Platform facts, measured on Node 22.23.1 and 24.19.0 with the installed `hono` 4.13.16 and `@hono/node-server` 2.1.6: `streamSSE` (`hono/streaming`) answers through `app.fetch` with a `text/event-stream` body readable as a `ReadableStream`, so a sim net route `req => app.fetch(req)` carries it unchanged; `WebSocket` is a global client on both Node versions and `EventSource` exists only behind `--experimental-eventsource`; `@hono/node-server`'s `upgradeWebSocket` needs a `ws` `WebSocketServer` passed to `serve`, `ws` is installed only as a dependency of happy-dom, and `createApp`'s `fetch` drops Hono's `env`, so an upgrade route could not reach the socket. Every browser Keel targets ships `EventSource` and streaming `fetch` bodies.

## Proposal

### 1. The model
The server stays the only authority. Reads stay loaders, writes stay actions, and a push only says that something changed.

1. A server store has a **head** (K1), a count of its changes that snapshots carry.
2. A client's view includes the head its read returned. A write sends that head as its **base** and a fresh **key** (std.offline `Write`); the action passes both to `tx`.
3. `tx` compares `base` with the store's head (K2). Equal: an ordinary commit. Different: the write is concurrent, and the transaction's declared policy decides: `'reject'` (the default) answers `keel.conflict` (409) with the head; `'rebase'` runs the pure transaction on the current state and keeps `base` on the entry. A key the kept log already holds commits nothing, so a resend is safe.
4. After the save, the server reports `{ kind: 'save', store, head }` to `observe` (K3). std.channels turns it into a `saved` event on every open member stream; std.live answers each with a re-read through the caller's own loader and a hydrating transaction.
5. While `ctx.net.online()` is false (K4), std.offline keeps writes in an outbox in `ctx.storage` and sends them in order on reconnect. A refused write waits in the outbox until the user resolves it, `'mine'` or `'theirs'`.
6. A rebased entry is a race when the order of it and its concurrent entries matters. std.conflicts finds races off the request path, on a store snapshot or on a session group (std.multi) replayed under simulation.

### 2. Transport: what S4 needs from RFC 0080
S4 builds std.channels on the server event stream S3 defines (expected in `@keel/std-streams`, section std.streams) and defines no transport of its own. The contract it needs, to reconcile with 0080:

- **T1 Route kind.** A `node` deployable route that answers GET with a server-sent event stream, events typed by a schema and encoded with it.
- **T2 Request flow of a loader.** Params and search parsed by schema (fail: 404) and guards before the stream opens, `caller` read from the signed cookie and never minted on a GET, and the route's `stores` factory available. A denial answers 403 `keel.denied`, not a redirect.
- **T3 Lifetime on `ctx`.** The stream ends when the client aborts (the request signal) or the producer ends it; heartbeats are timed with `ctx.clock`; no `setTimeout`. A cap on open streams per deployable is configurable.
- **T4 Client reader.** A stdlib reader over `ctx.net.fetch` with a streaming body, so real and sim run one code path and app code never names `EventSource` (E1601). Reconnection is the caller's (std.channels sets its own backoff on `ctx.clock`).
- **T5 Sim.** A stream served by `app.fetch` behind a sim net route reaches a sim client unchanged (measured above); with K4, going offline errors an open body.
- **T6 No resume needed.** std.channels sends `reset` first on every open and never resends missed events, so a `Last-Event-ID` resume is not required. If 0080 provides one, std.channels ignores it.

What 0080 is unlikely to provide, and S4 therefore owns: fan-out from any request to the streams open in the process (std.channels keeps it, fed by K3), membership re-checked after saves (std.channels), and the sim offline switch (K4). Cross-process fan-out for a split topology or several instances needs a broker and is neither RFC's (Known limits). If 0080 lands with a WebSocket transport instead, S4 still needs only the server-to-client direction; writes stay actions under the k.server write proof.

### 3. Kernel changes
One new kernel section, k.sync (Spec diff), holds all four; k.store, k.ctx and k.server each gain one pointer, and std.sessions gains one event kind. No change to k.reactive (Proposal 4, std.live), k.testing, k.router, k.services or k.runtime.

- **K1, k.store: heads.** `store.head()` rises by one per commit and per undo that undoes; an entry's `id` is the head it produced (entry ids are already a per-store counter, `store.ts:58`). `snapshot()` gains `head`, so folding past `logLimit` or a secret never loses it; `restore` of a snapshot without it uses the latest entry's id. An undo advances the head so that a writer who saw the state before it is concurrent. A scalar suffices because one server is the authority for each store; a version vector is for several.
- **K2, k.store: base, key and policy.** `tx(t, payload, { meta?, base?, key? })` and `transaction(store, name, Payload, fn, { concurrent? })` with `concurrent` `'reject' | 'rebase'`. The key is checked before the base, against the kept log; a concurrent `'reject'` write is `err` `keel.conflict` `{ store, transaction, base, head }`, which k.server already answers 409; a concurrent `'rebase'` write commits and keeps `base`. `base` and `key` are entry fields, not `meta`, so they survive `snapshot()`. Without `base`, nothing changes: existing apps never pass one.
- **K3, k.server: save reports.** After an action's save, each saved store goes to `observe` on the server ctx as `{ kind: 'save', store, head }`, in save order. This is the one point where a push can know the write landed. The read-set 409 stays as it is.
- **K4, k.ctx: connectivity.** `ctx.net.online()`; real reads `navigator.onLine` and its window events, sim has `setOnline(b)`, under which `fetch` rejects with a `TypeError` and open sim bodies error; every change is `{ kind: 'net', online }` to `observe`. std.sessions records it as an input, so an offline window replays.

Where the tokens come from: k.store drops "Transaction functions must be pure: E1302 on any `ctx` or global access." (its Rules line says the same) and the clause ", and `@keel/testing` runs it under generated payloads" (k.testing Properties says it); k.ctx shortens the `seedOf` sentence to its definition (the clause states the `undefined` case); std.sessions drops "Uploads are same-origin (E2006): the recording app serves `routes` itself.", which its E2005 and E2006 rules state. k.server takes its pointer from headroom. Counts are in Token impact.

### 4. Package contracts
Each package has one export per file, filename equals export, schemas first (`*.schema.ts`), and touches the world only through `ctx` capabilities that already have real, shell and sim implementations (`net`, `clock`, `storage`, `random`) and through `observe`. None registers a new capability: connectivity is part of `net` (K4). Every state they keep is JSON: outbox entries, channel events, groups and race reports parse with their schemas (principle 10). No package reads `Date`, `setTimeout`, `fetch`, `WebSocket` or `EventSource`.

| Package | Files (exports) | Extension points | Codes |
| --- | --- | --- | --- |
| `@keel/std-channels` | `channel.ts`, `Channel.ts` (type), `ChannelEvent.schema.ts`, `ChannelStatus.schema.ts`, `subscribe.ts`, `publish.ts`, `ChannelsConfig.schema.ts`; `./server`: `channelRoute.ts` (Node); `./tools`: E2601, E2602; `module.ts` (module `channels`, capabilities `clock`, `net`, `observe`) | module manifest, check rule registry | E260x |
| `@keel/std-live` | `live.ts`, `LiveStatus.schema.ts` | none (composes std.channels and k.store) | none |
| `@keel/std-offline` | `outbox.ts`, `Outbox.ts` (type), `OutboxEntry.schema.ts`, `OutboxResult.ts` (type), `Write.schema.ts`, `send.ts`, `drain.ts`, `resolve.ts`, `Resolution.schema.ts`; `./tools`: E2651 | check rule registry | E265x |
| `@keel/std-conflicts` | `races.ts`, `findRaces.ts`, `Race.schema.ts`, `Unchecked.schema.ts`, `raceFormatter.ts` (`conflicts.race`) | output formatter registry | E270x |
| `@keel/std-sessions` | `SessionEvent` gains `net`; `./group` (Node): `openGroup.ts`, `replayGroup.ts`, `SessionGroup.schema.ts` | (existing module) | E2007, E2008 |

- **std-channels.** `channel(name, { path, params, message? })` is a shared declaration; `channelRoute(channel, { id, stores, member })` in a `*.server.ts` file returns the route the serving module lists (route `id` prefixed by that module, E1155). The stream sends `reset` first, `saved` after each save of a store its factory creates, `message` for each publish to the same params, and `closed` when `member` turns false. `member({ caller, params, stores })` is pure and runs at open, at each publish and after each save of its stores. `subscribe` and `publish` are the client side. Server state per process is a hub keyed by the app's `ctx` (a `WeakMap`), fed by one `observe` per ctx; per-caller and per-process stream caps come from `std['@keel/std-channels']`, server-only.
- **std-live.** `live(ctx, origin, channel, params, { read, hydrate })` keeps a client store current: after each `reset` and `saved` it runs `read` and commits `tx(hydrate, value)`, one read at a time, never letting an older read commit after a newer one. It returns a status signal. It is composition (k.reactive unchanged): a live view is a store because a store updates in place, is logged, and is what sessions record and replay; a re-run `resource` would pass through `loading` on every push.
- **std-offline.** `outbox(id, api)` over a k.services endpoints map declares a client store of entries persisted in `ctx.storage`; `send` adds an entry with `Write` `{ key, base }`, `drain` loads and flushes it in a scope, `resolve` takes `'mine'` or `'theirs'` for a refused entry. Entries go through the existing k.services client, so timeouts, `ApiError` and the `x-keel` write proof are the same as any call.
- **std-conflicts.** `races(snapshot, stores)` replays a stored server store from `initial` and checks each rebased entry against its concurrent entries in both orders; `findRaces(group, ...)` replays a group and checks every server store; `conflicts.race` renders a race as E2701 (unchecked: W2702).
- **std-sessions.** `record` keeps `net` events, and `replay` applies them with `setOnline`. The `./group` subpath records and replays session groups: each user in its own worker thread with its own DOM, modules and sim ctx, all sharing one server and one timeline.

**Diagnostic blocks.** RFC 0079 holds E230x and E240x; E250x and E255x are left for RFC 0080. This RFC takes E260x (std.channels), E265x (std.offline) and E270x (std.conflicts), and adds E2007 and E2008 to std.sessions' E200x block for std.multi. std.live has no rules and takes no block.

### 5. Offline and conflict semantics
**Concurrency.** A write is concurrent when it names a `base` other than the store's `head()` at commit. Not passing `base` means not concurrent, which is every write today.

**Policies** (closed vocabulary, principle 4; declared by the store's author per transaction, default `'reject'`):
- `'reject'`: a concurrent write is refused, `keel.conflict` 409 with `{ store, transaction, base, head }`. Use it where the payload carries values the writer read (a full-field edit).
- `'rebase'`: a concurrent write runs its pure function on the current state, with schema and invariants checked as for any commit; the entry keeps `base`. Use it where the payload is an intent that holds on any state (a toggle, an add with a fresh id).

**The log.** An entry holding `base` is a rebased write and nothing else holds one, so the log itself records every resolution the server made. A refused write leaves no server entry; the client's outbox log records it (`<id>.settle` to `conflict`) and the user's choice (`<id>.resolve` `{ key, resolution }`). `'mine'` re-sends with `base` set to the refusal's head, so it applies as an ordinary write over what it conflicted with; `'theirs'` drops it. Undo treats every entry alike: the latest entry is undone and the head rises. No client applies another caller's entries, so no client log holds a remote entry.

**Keys.** `Write.key` is `ctx.random.id('Write')`, minted once per `send` and kept across resends. `tx` with a key that an entry in the kept log holds commits nothing and returns `ok` before the base is compared, so a write that committed and then lost its response is not applied twice and does not turn into a conflict.

**The outbox.** One FIFO per outbox, one request in flight. Bounds: `limit` 100 entries and `maxBytes` 262,144 of encoded entries; a full outbox refuses `send` with `offline.full`. Network failure keeps the entry queued and stops the flush until `{ kind: 'net', online: true }`, the next `send`, or a backoff of 1 s doubling to 60 s on `ctx.clock`. A 409 with `data.transaction` is a policy refusal: the entry becomes `conflict` and the flush moves on. A 409 without it is the read-set rule (two requests overlapped inside the server): the entry is sent once more, which is safe because of its key. Any other status is `failed`. The server's rejections are the existing ones: the read-set 409, 422 `keel.fields`, 403 `keel.denied` and 413; K2 adds only the policy 409.

**Races.** A rebased entry `e` with concurrent entries `C` (ids between its `base` and its own id) races when applying `C` then `e` and `e` then `C` from the state at `base` gives different states, or exactly one order fails. Arrays whose items all carry a string `id` compare as sets keyed by it, so two adds with fresh ids commute. The check needs the state at `base`, rebuilt from the kept log: an entry whose base was folded, or that follows an undo since the log's start, is reported unchecked. It never runs on a request, since a request holds only the current state and a timing-dependent refusal would hide the bug; it runs on replays, tests and stored snapshots.

### 6. Privacy and auth
- **What reaches another user's browser.** A `saved` event: a server store id and its head, only on streams whose `member` holds. A channel message: the value a member published, typed by the channel's `message` schema, with no publisher identity unless that schema has a field for it; it is not stored, logged or resent. Data the push makes a client re-read comes from that client's own loader, under that loader's output schema and checks (default 4: nothing travels unless a schema declares it).
- **What stays on the server** (default 5). `member`, `stores`, the hub, `save` events, `perCaller` and `maxStreams`, and every caller hash. `channelRoute` outside `*.server.ts` is E2601.
- **Auth per channel.** A stream GET reads the existing signed caller cookie (`HttpOnly; SameSite=Lax`, `__Host-` on https) and never mints one; a cross-site page cannot open it with the user's cookie, because `Lax` cookies are not sent on cross-site subresource requests, and a stream response sets no CORS header. A publish is an action under the existing same-site write proof, `maxBodyBytes` and 422. `member` decides membership from the caller hash, params and the server's stores, as `sessions.reader` decides readers. The caller hash is not authentication (THREAT-MODEL, Caller identity); a channel is as private as its `member`. Nothing here weakens the cookie or the write proof.
- **Secrets.** A channel `message` schema with `s.secret` is E2602 (and `channel` throws); an outbox over an endpoint whose body holds `s.secret` is E2651 (and `outbox` throws), so no secret persists in browser storage.
- **Sessions.** A user's session records what that user's stores hold, including data that came from others through hydration, under the module's `redact` entries as today. Session groups exist only under simulation.
- **Resource use.** Streams are capped per caller (8) and per process (1,000), and an open past either is `channels.full`; outboxes are bounded by `limit` and `maxBytes`.

### 7. Exit proof and golden-1
The proof extends the existing `evals/tasks/golden-1-api` task (default 3): TASK.md gains the multi-user behavior below, a hidden `acceptance.test.ts` holds the scenario, and `pass.ts` also runs the planted-race twin. `pnpm eval --task golden-1-api --runner none --strict` is the exit proof, and an agent build from scratch is held to the same bar.

**Why golden-1.** It already has one shared server store (`api.board`), per-request stores, `caller` in tx meta and a cookie per sim client (`test/simApi.ts`). golden-2's actions never read `caller` and its eval is S2's.

**golden-1 changes.**
- `api`: `addList`, `addTodo` and `toggleTodo` declare `{ concurrent: 'rebase' }`; `editTodo` keeps the default `'reject'`, since its payload carries both fields as the editor read them. `postList`, `postTodo`, `postEdit` and `postToggle` take `write: Write` in their input and call `tx(..., { meta: { caller }, ...input.write })`. `loadBoard` returns `head: board.head()`. New `boardEvents.server.ts`: `channelRoute(boardChannel, { id: 'api.boardEvents', stores: boardStores, member: () => true })` (the board is public), listed in `api/routes.ts`.
- `todos`: `BoardView` gains `head`. New `boardChannel.ts` (`channel('todos.board', { path: '/api/board/events', params: s.object({}) })`, no messages) and `boardOutbox.ts` (`outbox('todos.outbox', <the endpoints map todosApi uses>)`). `AppShell` calls `live(ctx, location.origin, boardChannel, {}, { read: refreshView's read, hydrate })` and `drain(ctx, boardOutbox)`, shows the status as `todos.live`, and lists outbox entries in `todos.outbox` with a Button pair `todos.outbox.mine.<key>` and `todos.outbox.theirs.<key>` on each conflict. `TodoRow`, the add Forms and `updateTodo` write through `send(ctx, boardOutbox, origin, endpoint, input, { base: view.get('head') })`. `syncAfter.ts` is deleted (std.live re-reads after every save, including the writer's own).
- `test/user.ts`: the group user entry (`routes` of `todos`, base `todos.index`).

**Driving two users.** `openGroup({ user: 'test/user.ts', serve: apiApp, users: 2, seed: 11, origin: 'http://golden-1.test', server: { 'api.board': board } })`: one api server on a sim ctx, two users, each in its own worker realm with its own DOM, client stores, sim ctx and caller cookie. Playwright with two browser contexts was the alternative; it captures real browsers but cannot replay under simulation, which the roadmap asks for, and its timing would not be reproducible.

**Fixture.** List `Home` (`l1`) with todos `Milk` (`t1`, normal) and `Bread` (`t2`), head 2.

**Script** (`settle()` after every step):
1. Both users navigate to `/lists/l1`. User 0 clicks `todos.toggle.t1`; user 1's `todos.toggle.t1` reads checked with no input from user 1 (std.live).
2. User 1 opens `/lists/l1/todos/t1/edit` (the form reads `Milk`, normal), goes offline (`setOnline(1, false)`), sets priority to high and clicks `todos.save`. Its outbox holds one `queued` entry with `base` 3.
3. User 1, still offline, clicks `todos.toggle.t2`: a second queued entry, `base` 3.
4. User 0 opens the edit page of `t1`, sets the title to `Oat milk` and saves (head 4), then adds the todo `Eggs` to `Home` through `todos.addTodo` (head 5).
5. User 1 comes back online (`setOnline(1, true)`); its outbox flushes in order.
6. `stop()` gives the group; the test writes it to `.keel/sessions/golden-1-race.group.json` in the eval's temp dir.

**Planting the race.** `pass.ts` copies `apps/golden-1` to a sibling temporary app (as `tooling/budgets.mjs` does for its injected-error fixture), changes `modules/api/editTodo.ts` to declare `{ concurrent: 'rebase' }`, runs the same scenario there with the race assertions, and removes the copy. The planted bug is the realistic one: a full-field edit declared safe to apply on any state.

**What the eval asserts.**
- Live: after step 1, user 1's checkbox is checked and its `todos.view` log gained one `todos.hydrate` entry and no other.
- Shipped app, after step 5: user 1's edit is refused (`keel.conflict`, head 5) and shown as a conflict with both Buttons; its toggle of `t2` is rebased (entry 6 holds `base` 3) and `t2` is done; the server's `t1` reads `Oat milk`, normal. Clicking `todos.outbox.theirs.<key>` empties the outbox; the server is unchanged.
- Planted twin, after step 5: the edit commits as a rebased entry and the server's `t1` reads `Milk`, high: user 0's rename is lost.
- Replay: `replayGroup(group, { user, serve })` gives `reproduced: true`, final server stores equal to the live run's, and each user's `state()` equal to its live state; two replays are byte-equal.
- Race report: `findRaces(group, { user, serve, stores: [boardStores] })` on the shipped app gives `races: []` and `unchecked: []` (the rebased toggle commutes with user 0's edit and add). On the planted twin it gives exactly one race: store `api.board`, `entry` `api.editTodo` with user 1's key, `against` holding user 0's `api.editTodo` #4 and `api.addTodo` #5, kind `order`. Its compact line is `E2701 .keel/sessions/golden-1-race.group.json:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board`, and the planted-twin run is byte-equal across two runs.
- Live parity: under one seed, two live runs of the script give byte-equal groups.

## Alternatives
- **WebSocket transport.** Bidirectional, but writes on the socket would bypass actions (write proof, `maxBodyBytes`, 422, read-set 409, keys) and make a second write path (default 2). On Node it needs the `ws` package, an `upgrade` listener outside Hono's `fetch` (which `createApp` does not forward), and its own Origin check against cross-site socket hijacking; `static` and `client` deployables cannot host it. SSE over a normal GET needs nothing new and keeps the cookie and guard path.
- **`EventSource` in the client.** No custom reconnect timing on `ctx.clock`, so sim and real would differ, and Node 22 has it only behind a flag. A reader over `ctx.net.fetch` runs the same code under both.
- **Pushing values (full state or patches).** Saves a round trip, but the push would need its own authorization and redaction per subscriber beside the loader's (a second read path, default 2), and a value already delivered outlives a membership change. Invalidation plus a re-read keeps one read path.
- **A k.reactive resource variant** that stays `ready` while re-fetching, or a `push(value)` on resources. Either changes every resource's transitions or adds a second async-read primitive, and the value would not be logged. Stores already update in place and are what sessions record.
- **A `Resource` look-alike from std-live.** It would not register an `inspect()` node, so `Match` would report no `resource` events to `observe`.
- **Replicating log entries to clients** (clients apply pushed entries and replay their pending ones on top). It needs a generic apply-transaction endpoint, a second write path beside actions that exposes every transaction to every client, and client-side rebase rules. A later RFC can add optimistic local application over the outbox.
- **A CRDT library** (Yjs, Automerge). A second state model beside stores: merges bypass the store's invariants, its history is not the Keel log, and sessions could not replay it. S4's data are records edited field-wise, which the two policies cover; collaborative text editing is not in S4.
- **More policies** (`last-writer`, `merge`, `first-writer`). `rebase` already is "later arrival applies"; a path-level `merge` that refuses only overlapping writes needs a state diff per write on the request path and a path vocabulary. Two policies cover S4 and a later RFC can add one.
- **Refusing non-commuting rebases at runtime.** Needs the state at `base` on every stale write (a replay from `initial` per request) and turns a design error into a refusal that depends on timing. The race check runs where order is reproducible.
- **Version vectors.** For several writable replicas; each Keel store has one authority, so a scalar head is enough.
- **An idempotency header in k.server** (`x-keel-key`). A hidden channel beside the action's input, and k.services has no per-call options; the explicit `write` field is local to the endpoint that needs it.
- **Retrying the action on the server after a read-set 409.** Re-runs the action's effects; the outbox resends with the same key instead.
- **Queueing raw requests at the net layer.** Bodies would be untyped, so `send` could neither fill `write` nor refuse secrets.
- **Two users in one realm.** Client stores are module-global and every harness renders into one `document`, so element ids and stores collide; each user needs its own realm.
- **Splitting std.sessions** for the group contract. std.sessions is at 1,498 tokens and moving its Ingest paragraph would re-quote three conformance headers; a new section in the same package changes none.
- **Raising the spec map budget** instead of moving the stdlib table to `spec/std/README.md`. The stdlib table grows by a row per package each stage (S3 adds its own); the index already exists and section statuses are read from the section files, not the map.
- **A `golden-1-live` eval of its own.** A second eval for one app; extending `golden-1-api` holds the agent-build eval to the S4 bar as well (default 3).

## Spec diff
Token counts are `ceil(length / 4)`, the rule `tooling/budgets.mjs` uses, measured by applying these edits to copies of the sections as committed when this RFC was written (S2's spec text included). No existing Conformance clause changes text or number; every edit to an existing section is in body text.

### k.store (1,495 to 1,488)
- API: "Writes: only via `tx(addItem, payload, { meta }?)`;" becomes "Writes: only via `tx(addItem, payload, { meta, base, key }?)`;".
- API: "`snapshot()` is `{ state, log, initial }`." becomes "`snapshot()` is `{ state, log, initial, head }`. Heads, a write's `base` and `key`, and `transaction(..., { concurrent })`: k.sync."
- Trims: in Ownership, "Transaction functions must be pure: E1302 on any `ctx` or global access." (Rules states E1302); in Ids and invariants, "; it is declared once, next to the store, and `@keel/testing` runs it under generated payloads." becomes "; it is declared once, next to the store." (k.testing Properties states the rest).

### k.ctx (1,489 to 1,496)
- Observers: "`{ kind: 'error', error }` when a `Boundary` catches or a loader or action returns `err`." gains "; `save` and `net`, with `ctx.net.online()`: k.sync."
- Trim: "`seedOf(ctx)` is the seed `createCtx` was given, `undefined` when none." becomes "`seedOf(ctx)`: the seed `createCtx` was given." (its clause states the `undefined` case).

### k.server (1,462 to 1,470)
- Server state: "`err` or a throw saves none." becomes "`err` or a throw saves none; saves reach `observe` (k.sync)."
- If RFC 0080 splits k.server, this clause moves with the Server state paragraph.

### std.sessions (1,498 to 1,498)
- `SessionEvent`: "| { kind: 'error'; route; error: KeelError })" becomes "| { kind: 'error'; route; error: KeelError } | { kind: 'net'; online })".
- Replay: "applies inputs (`fire`, `nav`); others are observations." becomes "applies inputs (`fire`, `nav`, `net`: `setOnline`); others are observations. Groups of users: std.multi."
- Trim: "Uploads are same-origin (E2006): the recording app serves `routes` itself." (Rules E2005 and E2006 state both).

### spec/00-map.md (orchestrator; 1,081 to 829)
- Code ranges: the E200x owner becomes "std.sessions, std.multi"; after the E230x row add "| E260x | std.channels | E265x | std.offline |" and "| E270x | std.conflicts | | |". E250x and E255x stay free for RFC 0080.
- Kernel table, after k.server: "| k.sync | Heads and concurrent writes | proposed | store heads, write base and key, reject or rebase, save and net events |".
- The Stdlib table moves to `spec/std/README.md` under "## Sections", and the map's Stdlib heading keeps one line: "Sections, statuses and their extension points: `spec/std/README.md`." This leaves room for S3's and S4's rows under the 1,200 cap; statuses are read from the section files (`packages/cli/src/internal/coverageGaps.ts`), not the map.

### spec/std/README.md (orchestrator; 144 to 615)
Gains the moved table plus these rows, and the line "S4 (RFC 0081) adds std.channels, std.live, std.offline, std.conflicts and std.multi.":
```
| std.channels | Channels | proposed | module manifest and check rule registry: named channels over a server event stream, E2601-E2602 |
| std.live | Live views | proposed | composes std.channels: a client store re-read on every push |
| std.offline | Outbox | proposed | check rule registry: queued writes with keys and bases, resolve, E2651 |
| std.conflicts | Races | proposed | formatter registry: order-dependent rebased entries, E2701 |
| std.multi | Multi-user sessions | proposed | std-sessions: groups of users recorded and replayed under simulation, E2007-E2008 |
```

### spec/kernel/k.sync.md (new, 1,140)
~~~md
# k.sync: Heads, concurrent writes and connectivity
status: proposed

Several callers write one server store (k.server Server state), so a client's copy of it is older than the store whenever another caller saved after the client read. This section gives each store a head, lets a write name the head its writer saw, says per transaction what happens when the two differ, and gives `ctx.net` a connectivity state.

**Heads.** `store.head()` counts the store's changes: 0 for a new store, one more after each commit and after each `undo` or `undoWhere` that undoes. A commit's log entry `id` is the head it produced, so an undo leaves a gap in ids. `snapshot()` holds `head`; `restore` sets it (a snapshot without one: its latest entry's `id`, else 0). Folding past `logLimit` or a secret never changes it.

**Writer base.** `tx(t, payload, { meta?, base?, key? })`. `base` (an integer >= 0) is the head the writer last read; the write is concurrent when `base` is not `head()`. Its transaction declares what happens then: `transaction(store, name, Payload, fn, { concurrent? })`, exposed readonly as `concurrent`:
- `'reject'` (default): `err` with code `keel.conflict` and data `{ store, transaction, base, head }`; nothing commits. k.server answers it 409.
- `'rebase'`: `fn` runs on the current state like any commit (schema, invariants), and the entry keeps `base`.

A write that is not concurrent keeps no `base`, so an entry holding `base` is a rebased write. Without `base`, `tx` is as k.store says.

**Write key.** `key` (1 to 64 characters) names one write across retries. When an entry in the kept log holds that `key`, `tx` commits nothing and returns `ok` with the current state; `key` is checked before `base`. The entry keeps `key`. `base` and `key` are entry fields, not `meta`, so `snapshot()` keeps them. A `base` or `key` of the wrong type is `schema.invalid`.

**Saves.** After an action's save (k.server), each store it saved is reported to `observe` on the server ctx as `{ kind: 'save', store, head }`, in save order. A refused or `err` action reports none. The read-set rule is unchanged: a store the action only read and another request saved since is 409, whatever its transactions declare.

**Connectivity.** `ctx.net.online(): boolean`. Real and shell: `navigator.onLine` where a global `navigator` exists, updated on the window's `online` and `offline` events; else `true`. Sim: `true` until `setOnline(false)` on the sim net; while offline, `fetch` rejects with a `TypeError` and each response body a sim route returned that is still open errors. Each change is reported to `observe` as `{ kind: 'net', online }`. Neither `save` nor `net` is replayed to a later observer.

**Clients.** No client applies another caller's log entries: a client copy is replaced by a hydrating transaction (std.live), so `undo` on a client store undoes only that client's own transactions. Pushing changes, queueing writes and finding races are stdlib (std.channels, std.live, std.offline, std.conflicts).

**Conformance.**
- `head()` is 0 for a new store and rises by exactly one per commit and per undo that undoes; a refused `tx` leaves it unchanged; each entry's `id` is the head after its commit.
- `restore(snapshot())` keeps `head()`; a snapshot without `head` restores its latest entry's `id`, else 0; folding past `logLimit` or a secret leaves `head()` unchanged.
- A transaction declared without `concurrent` exposes `concurrent` `'reject'`.
- Under `'reject'`, `tx` with a `base` other than `head()` returns `err` `keel.conflict` with data `{ store, transaction, base, head }` and changes nothing; with `base` equal to `head()` it commits an entry without `base`.
- Under `'rebase'`, `tx` with a `base` other than `head()` commits on the current state and the entry holds that `base`; an invariant failure is `store.invariant` and commits nothing.
- `tx` with a `key` that a kept entry holds returns `ok`, commits nothing and leaves `head()` unchanged, also when its `base` is stale.
- An entry's `base` and `key` survive `snapshot()`, a JSON round trip and `restore`.
- An action that saves two stores reports two `save` events to an observer of the server ctx, after both are stored, each with its store's new head; a 409 or `err` action reports none.
- Under sim, after `setOnline(false)`, `online()` is false, `fetch` rejects with a `TypeError`, an open sim response body errors, and an observer gets one `{ kind: 'net', online: false }`; `setOnline(true)` reverses each.
- Under real with no global `navigator`, `online()` is true.
~~~

### spec/std/std.channels.md (new, 1,287)
~~~md
# std.channels: Channels
status: proposed

**Extension points.** Module manifest: stdlib module `channels` (capabilities `clock`, `net`, `observe`), whose route an app lists in a `node` deployable's manifest. Check rule registry: E2601 and E2602 through `@keel/std-channels/tools`.

**Declare.** In a shared file whose name is the export:
```ts
export const boardChannel = channel('todos.board', { path: '/api/board/events', params: s.object({}), message: BoardMessage })
```
`channel(name, { path, params, message? })`: `name` is prefixed by the declaring module, as E1155 asks of route ids. `params` is parsed from the stream URL's search (fail: 404) and picks an instance. `message` (optional) is the schema of what members publish; without it nothing can be published. `channel` throws E2602 when `message` holds an `s.secret`.

**Serve.** In a `*.server.ts` file (else E2601):
```ts
export const boardEvents = channelRoute(boardChannel, { id: 'api.boardEvents', stores: boardStores, member: ({ caller, params, stores }) => true })
```
returns the route `{ id, path, stream, actions: { POST } }` for the serving module's manifest (`id` prefixed by that module, E1155; `path` the channel's). `stream` is a server event stream (std.streams) of `ChannelEvent<M>`:
- `{ kind: 'reset' }`, first on every open: the client re-reads; nothing missed while closed is resent.
- `{ kind: 'saved', store, head }` after each save of a store `stores` creates (k.sync `save`), in save order, to every open member stream.
- `{ kind: 'message', message }` for each publish to the same channel and params, the publisher's stream included.
- `{ kind: 'closed', reason: 'denied' }`, then the end of the stream, when `member` turns false.

`member` is a pure predicate over the request's `caller`, the parsed `params` and `stores` opened read-only. It runs at open (false: 403 `keel.denied`, no stream), at each publish (false: 403, nothing delivered) and, for each open stream, after each save of its stores. A stream request reads the caller cookie and never sets one. The POST takes `{ message }` as an action: the k.server same-site proof, `maxBodyBytes` and 422 `keel.fields` apply, and it answers `ok(null)` once delivered. Delivery reaches the streams open in the serving process. Config `std['@keel/std-channels']: { perCaller?, maxStreams? }` (server-only; defaults 8 and 1,000): an open past either is `err` `channels.full`.

**Client.**
- `subscribe(ctx, origin, channel, params, on)`, inside a scope: opens the stream through the std.streams reader on `ctx.net.fetch` and calls `on(event)` for each event. After a drop it reconnects 1 s later, doubling to 30 s on `ctx.clock`; it makes no request while `ctx.net.online()` is false and reconnects on `{ kind: 'net', online: true }`. Returns `{ status, close }`: `status()` reads a signal, `'connecting' | 'open' | 'offline' | 'denied'`; after `denied` it stops. Disposing the scope closes the stream.
- `publish(ctx, origin, channel, params, message)`: `Promise<Result<null, ApiError>>`, through `@keel/services` (k.services errors and timeout).

**Privacy.** Events carry no caller, cookie or store state: `saved` names the store and its head, and each member re-reads through its own loader. A message reaches every member's browser as published, with no publisher identity unless its schema holds one; it is never stored, logged or resent. `stores` and `member` stay on the server.

**Rules.** E2601 `channelRoute` outside a `*.server.ts` file · E2602 a channel `message` schema holding an `s.secret`.

**Conformance.**
- A member's stream starts with `{ kind: 'reset' }` and then gets `{ kind: 'saved', store, head }` after each save of a store its channel's `stores` creates, in save order.
- A caller for whom `member` is false gets 403 `keel.denied` at open and no stream; a cookieless open has caller `""` and its response sets no cookie.
- After a save that makes `member` false for an open stream's caller, that stream gets `{ kind: 'closed', reason: 'denied' }` and ends, and the other members' streams continue.
- A member's publish delivers `{ kind: 'message', message }` to every open member stream of the same channel and params, the publisher's included, and to none with other params; a non-member's publish is 403 and delivers nothing.
- A publish without same-site proof is 403 `keel.denied` and one failing `message` is 422 `keel.fields`; neither delivers anything.
- No delivered event holds a caller hash, a cookie value or a store's state.
- Under sim, `subscribe` reconnects 1 s, 2 s, 4 s after successive drops on `ctx.clock`, sends nothing while `online()` is false, reconnects on `{ kind: 'net', online: true }`, and its `status()` passes through `connecting`, `open`, `offline` and `denied` as those happen.
- Disposing the scope that called `subscribe` aborts its request, and `on` gets no later event.
- An open past `perCaller` streams for one caller is refused with `channels.full`, and the earlier streams continue.
- `channel` throws E2602 for a message schema with a nested `s.secret`; `keel check` reports E2601 and E2602 on fixtures and nothing on their clean twins.
~~~

### spec/std/std.live.md (new, 680)
~~~md
# std.live: Live views
status: proposed

**Extension points.** None of its own: it composes std.channels `subscribe` with a k.store transaction. No rules.

**API.**
```ts
const status = live(ctx, origin, boardChannel, {}, { read: (ctx) => readBoard(origin, ctx), hydrate })
```
`live(ctx, origin, channel, params, { read, hydrate })` runs inside a scope (a component or `scope(fn)`; outside one it throws E1203) and returns `status`, a signal read: `'connecting' | 'live' | 'offline' | 'denied'`. It subscribes to the channel and runs `read(ctx)` (`Promise<Result<P, E>>`, a loader or k.services call) after each `reset` and each `saved` event; an `ok` value commits `tx(hydrate, value)`. `hydrate` is a transaction on a client store with payload `P`, listed in the calling component's `uses` (E1301). `message` events are not its concern.
- One read at a time: events that arrive during a read cause exactly one more read after it, and a read never commits after a read started later.
- `status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or a read is pending or failed; `offline` while `ctx.net.online()` is false; `denied` once the channel denies.
- A failed read commits nothing and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event, whichever is first.
- Disposing the scope closes the stream and drops the result of a read in flight.

A live view is a client store kept current by its hydrating transaction. Values never travel on the push, so each caller holds what its own `read` returns, and each hydration is a logged transaction that a session records and a replay re-derives. The head a write names as its `base` (k.sync) is data the app's `read` returns like any other field.

**Conformance.**
- After the stream opens, `read` runs once and its value is committed with `hydrate`; `status()` is `connecting` before that commit and `live` after it.
- Three `saved` events during one read cause exactly one more read.
- A read that resolves after a read started later commits nothing.
- A read returning `err` commits nothing, `status()` is `connecting`, and reads run again 1 s, then 2 s, then 4 s later on `ctx.clock` until one succeeds.
- Under sim, after `setOnline(false)`, `status()` is `offline` and no read runs; after `setOnline(true)` the stream reopens and exactly one read runs.
- With callers A and B subscribed to one sim server, a write by A is in B's hydrated store after B's next read, with no input from B.
- Disposing the scope closes the stream, and a read in flight then commits nothing.
- Under one seed, two runs of one script of saves give byte-equal logs on the hydrated store.
~~~

### spec/std/std.offline.md (new, 1,193)
~~~md
# std.offline: Outbox
status: proposed

**Extension points.** Check rule registry: E2651 through `@keel/std-offline/tools`. It uses `ctx.storage`, `ctx.net`, `ctx.clock`, `ctx.random` and `observe` (`net` events).

**Declare.** In a client-safe file whose name is the export:
```ts
export const boardOutbox = outbox('todos.outbox', BoardApi, { limit: 100 })
```
`outbox(id, api, { limit = 100, maxBytes = 262144 })` over a k.services `endpoints` map creates the client store `id` (prefixed by its module, E1155), state `{ entries: OutboxEntry[] }`, changed only by its transactions `<id>.add`, `<id>.settle` and `<id>.resolve`. `OutboxEntry` is `{ key, endpoint, origin, input, base, at, state, head?, error? }`, `state` one of `queued`, `sending`, `conflict`, `failed`. `outbox` throws E2651 when an endpoint's body holds an `s.secret`.

**Write.** An endpoint an outbox sends to has `body: s.object({ ..., write: Write })`, where `Write` is `s.object({ key: s.id('Write'), base: s.number({ int: true, min: 0 }) })`. Its action passes both to the store: `tx(t, payload, { meta, ...input.write })` (k.sync).
```ts
const r = await send(ctx, boardOutbox, origin, 'editTodo', { params: { todoId }, body: { title, priority } }, { base: view.get('head') })
```
`send` adds an entry whose `body.write` is `{ key: ctx.random.id('Write'), base }`, writes the outbox to `ctx.storage` key `keel.outbox.<id>`, and flushes. It resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }` (offline, or the network failed), `{ state: 'conflict', head }` or `{ state: 'failed', error }`. A full outbox (`limit` entries, or `maxBytes` of encoded entries) resolves `failed` with `offline.full` and adds nothing.

**Flush.** Entries are sent in the order added, one request at a time, through the k.services client:
- 2xx: the entry is removed; `sent`.
- `api.network` or `api.timeout`: it stays `queued` and flushing stops, to resume on `{ kind: 'net', online: true }`, on the next `send`, or 1 s later doubling to 60 s on `ctx.clock` while `online()` holds.
- 409 `keel.conflict` with `data.transaction` (a k.sync refusal): `conflict`, keeping `data.head`; the next entry goes.
- 409 without it (the request overlapped another save): sent once more; a second such 409 is `failed`.
- Any other status: `failed` with its `ApiError`; the next entry goes.

`drain(ctx, outbox)`, inside a scope, loads the stored outbox (`sending` entries become `queued`), flushes, and flushes again on each reconnect until the scope is disposed. A resent entry keeps its key, so a write the server already committed commits nothing again (k.sync).

**Resolve.** `resolve(ctx, outbox, key, resolution)`, `resolution` `'mine'` or `'theirs'`. `'mine'` queues a `conflict` entry again, last, with `base` set to its `head`, so the write applies over what it conflicted with; `'theirs'` removes a `conflict` or `failed` entry. The outbox log records each as `<id>.resolve` `{ key, resolution }`.

**Privacy.** Entries stay in the browser's storage and go only to their endpoint; E2651 keeps secrets out of them. A session records the outbox's transactions, and a module's `redact` entries cover their payloads.

**Rules.** E2651 an `outbox` whose api has an endpoint body holding an `s.secret`.

**Conformance.**
- With `online()` true and an empty outbox, `send` posts once with `body.write` `{ key, base }`, `key` a fresh `Write` id, and resolves `sent` with the endpoint's output.
- After `setOnline(false)`, three `send`s resolve `queued`, post nothing, and leave the three entries in order in `ctx.storage` `keel.outbox.<id>`; `drain` on a new ctx over that storage holds them `queued`.
- After `setOnline(true)`, queued entries are posted in the order added, one at a time, each with its original key.
- When the fetch rejects after the server committed, the entry is resent with the same key and the server store holds one entry for that write.
- A 409 with `data.transaction` leaves the entry `conflict` with that `head`, and the next entry is posted; a 409 without it is sent once more.
- `resolve(ctx, o, key, 'mine')` queues the entry last with `base` equal to its conflict `head`; `'theirs'` removes it; each adds one `<id>.resolve` entry to the outbox log.
- `send` to an outbox holding `limit` entries resolves `failed` with `offline.full` and adds nothing.
- After a network failure the next post happens 1 s, 2 s, 4 s later on `ctx.clock` (at most 60 s apart), or at once on `{ kind: 'net', online: true }`.
- `outbox` throws E2651 for an api with a nested `s.secret` in an endpoint body; `keel check` reports E2651 on that fixture and nothing on its clean twin.
- Under one seed, two runs of one script of sends and connectivity changes give byte-equal outbox and server logs.
~~~

### spec/std/std.conflicts.md (new, 846)
~~~md
# std.conflicts: Races
status: proposed

A rebased entry (k.sync: it holds `base`) was written by someone who had not seen the entries committed between `base` and it, its concurrent entries. It races them when order matters: applied before them, it gives a different result than after them. A `'rebase'` declaration says any order is acceptable; a race is evidence that the transaction should be `'reject'`, or that its payload carries a value read from a stale copy.

**Extension points.** Output formatter registry: `conflicts.race` renders a race as a diagnostic (E2701, W2702).

**API.**
- `races(snapshot, stores)`: `snapshot` is a server store as stored (`keel.store.<id>`), `stores` the factory (k.server Server state) that declares its transactions. Returns `{ races: Race[], unchecked: Unchecked[] }`. For each rebased entry `e` with concurrent entries `C`, from the state at `base` (replayed from `initial`) it applies `C` then `e`, and `e` then `C`, each entry with its own transaction function and the store's invariants. `e` races when exactly one order fails, or both succeed with different states. States compare as JSON, except that an array whose items are all objects with a string `id` compares as a set keyed by `id`.
- `Race` is `{ store, entry: Ref, against: Ref[], kind: 'order' | 'invalid' }` (`invalid`: one order fails), `Ref` is `{ id, name, key? }`, `against` lists `C`. An entry whose base state cannot be rebuilt is `Unchecked` `{ store, id, reason }`: `folded` when `base` is older than the kept log, `undo` when an id gap (an undo) lies between the kept log's start and the entry.
- `findRaces(group, { user, serve, stores })` replays a session group with `replayGroup` (std.multi) and runs `races` on the final snapshot of every store the replayed server holds that a factory in `stores` declares: `{ replay, races, unchecked }`.
- Compact: `E2701 <file>:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board` (at most two of `against`, then `+n`); an unchecked entry is `W2702 <file>:1:1 unchecked api.editTodo #6 on api.board (folded)`. Records are `{ kind: 'diag', ... }` (OUTPUT.md).

The analysis is pure and never runs on a request: it needs the state at `base`, which a request does not hold, and a refusal there would depend on timing. It runs where order is reproducible: a replay, a test, or a snapshot.

**Conformance.**
- A rebased entry setting a todo's title after a concurrent entry setting it to another value is one `order` race whose `against` names that entry.
- Two concurrent rebased toggles of one todo, and concurrent rebased adds of items with distinct `id`s, are no race.
- A rebased entry whose other order fails an invariant is an `invalid` race.
- A rebased entry whose `base` is older than the kept log is `unchecked` `folded`; one after an undo since the kept log's start is `unchecked` `undo`.
- Entries without `base` are never examined: a snapshot with none gives `{ races: [], unchecked: [] }`.
- `races` returns equal results for equal inputs and leaves `snapshot` and every live store unchanged.
- On a group whose replayed server holds a rebased lost update, `findRaces` reports it, and on the same group with that transaction `'reject'` it reports none; two runs are byte-equal.
- The `conflicts.race` formatter renders a race as E2701 and an unchecked entry as W2702 in compact and json.
~~~

### spec/std/std.multi.md (new, 737)
~~~md
# std.multi: Multi-user sessions
status: proposed

**Module.** Part of `@keel/std-sessions`, subpath `./group` (Node only). A session group is the sessions of several users of one server, recorded under simulation on one timeline:
```ts
type SessionGroup = { v: 1; seed: number; at: number; origin: string; server: { [store]: JsonValue }; users: Session[] }
```
`server` holds each server store, as stored in `keel.store.<id>`, when the group opened.

**Record.** `openGroup({ user, serve, users, seed, origin, at?, server? })`. `user` is the URL of a module exporting `{ routes, base: { id, params, search } }`; `serve(ctx)` returns the server (`{ fetch }`, as `createApp` does) over a sim ctx of seed `seed` whose storage starts with `server`. Each user runs in its own worker thread, with its own DOM, modules and sim ctx (seed derived from `seed` and its index), renders `base` at `at` (default 0) under `record(ctx, { limit: Infinity })`, and reaches the server through its sim net at `origin` with its own cookie jar; other URLs are 404. The handle:
- `user(i)`: `fire`, `navigate`, `find` and `state`, as k.testing's harness gives them.
- `setOnline(i, b)`: that user's sim net (k.sync).
- `advance(ms)`: every clock, the server's included.
- `settle()`: resolves when no request or stream chunk is in flight and every user has settled.
- `stop()`: the `SessionGroup`.

**Net events.** std.sessions records `{ kind: 'net', online }` (k.sync) as an input; `replay` and `replayGroup` apply it with `setOnline`.

**Replay.** `replayGroup(group, { user, serve })` restores the server storage from `group.server`, opens every user at its session's base, then applies all users' inputs in order of `at`, then user index, then event index, advancing every clock to each `at` and settling after each input. It returns `{ users: ReplayResult[], server: { [store]: Snapshot }, reproduced }`: `server` holds each server store with its log, `reproduced` holds iff every user's fingerprint matches.

**Privacy.** A group is a simulation artifact: `openGroup` runs only on sim ctxs, and a group holds what each user's `record` kept under its `redact` entries.

**Rules.** E2007 a group file fails `SessionGroup` · E2008 a group user's session has no `seed`. Both diag the file at 1:1.

**Conformance.**
- Under one seed, two runs of one script on `openGroup` give byte-equal groups.
- `replayGroup` of a recorded group ends with every server store equal to the live group's final store and each user's `state()` equal to its live final state; two replays are byte-equal.
- Two users of one group get distinct `caller`s, and one user's `find` never returns the other's elements.
- Inputs of different users apply in order of `at`, then user index, then event index.
- A `net` event that `record` captured is applied by `replay` and `replayGroup` as a `setOnline` call and recorded again.
- E2007 and E2008 each fire on a fixture and not on its clean twin.
~~~

## Conformance diff
The conformance-writer of each lane writes these from the accepted spec text, skipped until implementation; each clause is cited verbatim by exactly one file. k.store, k.ctx, k.server and std.sessions keep their clause lists, so they stay `conformance-covered` and `keel ledger --diff` reports nothing new for them; k.sync and the five new std sections are `proposed`.

- **Kernel, added (k.sync, one file per clause in order).** `packages/store/conformance/sync-head.test.ts`, `sync-head-restore.test.ts`, `sync-concurrent-default.test.ts`, `sync-reject.test.ts`, `sync-rebase.test.ts`, `sync-key.test.ts`, `sync-entry-fields.test.ts`; `packages/server/conformance/sync-save-observe.test.ts`; `packages/ctx/conformance/sync-sim-offline.test.ts`, `sync-real-online.test.ts`.
- **Kernel, edited.** None. No existing header quotes a changed clause, and no existing assertion changes: `head` is a new snapshot field that only new clauses read, `restore` accepts a snapshot without it, entries without `base` or `key` are as before, and an `undo` that returns `false` or a refused `tx` leaves the head alone (`packages/store/conformance/undo.test.ts`, `meta.test.ts`).
- **std-channels, added.** `reset-saved`, `member-open`, `member-closed`, `publish-scope`, `publish-proof`, `no-identity`, `subscribe-backoff`, `subscribe-dispose`, `per-caller`, `rules-e2601-e2602` (`.test.ts` in `packages/std-channels/conformance/`).
- **std-live, added.** `first-read`, `coalesce`, `stale-read`, `read-retry`, `offline`, `two-callers`, `dispose`, `deterministic`.
- **std-offline, added.** `send-online`, `queue-offline`, `flush-order`, `lost-response`, `conflict-409`, `resolve`, `full`, `backoff`, `e2651`, `deterministic`.
- **std-conflicts, added.** `order-race`, `commuting`, `invalid-race`, `unchecked`, `no-base`, `pure`, `find-races`, `formatter`.
- **std-sessions (std.multi), added.** `group-deterministic`, `group-replay`, `group-isolation`, `group-order`, `net-event`, `e2007-e2008` in `packages/std-sessions/conformance/`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): replaying any generated log from `initial` reproduces `head()`; for generated logs of `'rebase'` toggles and adds with fresh ids, `races` reports none, and for generated pairs of differing title sets it reports one; an outbox posts every generated script's entries in order with each key once; std.live commits at most one read per event burst; a generated group replays byte-equal.

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (k.sync and the five std sections; the k.store, k.ctx, k.server and std.sessions edits; the map and `spec/std/README.md`). ADRs are written. Create `packages/std-channels` (exports `.`, `./server` for Node, `./tools`, `./module`), `packages/std-live`, `packages/std-offline` (`.`, `./tools`) and `packages/std-conflicts`, each with `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, an empty `src/index.ts`, `conformance/` and `unsafe/`, in the std-money shape; add the `./group` export to `packages/std-sessions/package.json` with `happy-dom` and `tsx` as dependencies of that subpath (the worker realm loads TypeScript and a DOM). Set the `tooling/deps.json` order: after `std-sessions` (and after S3's `std-streams`), `std-channels`, `std-live`, `std-offline`, `std-conflicts`. Add the `tooling/budgets.json` entries and the re-base (Token impact). Add the four packages to `apps/golden-1/package.json`. Run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 to K4) | `packages/store/src/**`; `packages/ctx/src/**`; `packages/server/src/**`; the kernel conformance files above; kernel changesets | nothing; lands K1 and K2 as its first commit, K4 second, K3 third | `pnpm --filter @keel/store --filter @keel/ctx --filter @keel/server run check`, the same with `run test` |
| channels | `packages/std-channels/**` | K3, K4; S3's stream route and reader | `pnpm --filter @keel/std-channels run check && pnpm --filter @keel/std-channels run test` |
| live-offline | `packages/std-live/**`, `packages/std-offline/**` | K1, K2, K4; `subscribe` from channels for std-live | `pnpm --filter @keel/std-live --filter @keel/std-offline run check && pnpm --filter @keel/std-live --filter @keel/std-offline run test` |
| sessions-group | `packages/std-sessions/**` | K4 | `pnpm --filter @keel/std-sessions run check && pnpm --filter @keel/std-sessions run test` |
| conflicts | `packages/std-conflicts/**` | K1, K2; `replayGroup` for `findRaces` | `pnpm --filter @keel/std-conflicts run check && pnpm --filter @keel/std-conflicts run test` |
| golden-1 | `apps/golden-1/**`, `evals/tasks/golden-1-api/**` (TASK.md, `acceptance.test.ts`, `pass.ts`; `spec-slice.txt` gains k.sync and the key lines of std.channels, std.live and std.offline) | every lane | `pnpm --filter golden-1 run check && pnpm --filter golden-1 run test && pnpm eval --task golden-1-api --runner none --strict` |

Order: kernel, sessions-group and channels start at once. sessions-group proves the worker realm first (one user in a worker, rendering, firing and reaching a main-thread `app.fetch`), since the exit proof rests on it. live-offline writes std-offline first (it needs no channel) and std-live once `subscribe` lands. conflicts writes `races` against K1 and K2, then `findRaces` once `replayGroup` lands. golden-1 starts with schemas, policies and the eval task, and finishes last. That is five implementation agents and one kernel agent, the program's batch budget. Mutation runs (kernel packages, then std packages) go alone after the batch. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, ledger diff, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0287 (kernel lane, `packages/store`: an effect that throws during a `tx` commit comes out of `tx()` after state and log changed; K2 changes the same commit path); 0273 (kernel lane, `packages/server`: the same-site check compares `Origin` with an `http://` URL behind a TLS proxy, which every channel publish passes through); 0306 if still open (kernel lane, `packages/server`: the happy-dom stack in server tests); 0270 and 0302 (sessions-group lane, `packages/std-sessions`: one clause cited by five files; E2005 missing `createRequire` forms). 0288, 0289 and 0290 (`packages/reactive`, `packages/runtime-dom`), 0257, 0258 and 0261 (`packages/check`), 0275 (`packages/router`), 0303 and 0304 are in packages no lane owns and wait.

## Migration
- **Kernel callers.** `head()`, `base`, `key`, `concurrent`, `online()`, `setOnline` and the `save` and `net` events are additions. A snapshot gains `head`; a snapshot written without it (golden-1's `seedBoard`, stored dev data) restores with its latest entry's id. The only `CtxEvent` consumer outside `packages/ctx` is `packages/std-sessions` (`recording.ts`, `redactSession.ts`), which the sessions-group lane updates: it records `net` and ignores `save`. Writes that pass no `base` behave as before, so no existing app changes behavior.
- **Sessions.** `SessionEvent` gains `net`. Sessions recorded before still parse; a session holding `net` fails an ingest service on an older `@keel/std-sessions`, so `apps/sessions` upgrades with the package.
- **golden-1** (Open question 2). As Proposal 7 lists: policies on four transactions, `write` in four action inputs and the endpoints map, `head` in `BoardView`, the channel and its route, the outbox, `live` and `drain` in `AppShell`, the outbox panel, `syncAfter.ts` deleted, `test/user.ts` added; tests and README follow.
- **Docs.** `docs/ARCHITECTURE.md` gains Borrow vs build rows "Server push: borrow Hono `streamSSE` through std.streams; build invalidation and channels" and "Concurrent writes: build store heads, two policies and the race finder; no CRDT library". Each new package gets a README in the std-money shape. The `keel-api` skill gains three lines: a write sends `write` (`key`, `base`) and the action passes it to `tx`; a transaction declares `'rebase'` only when its payload holds on any state; live views use `live` and writes use the outbox.

## Token impact
Sections after the change (measured): k.store 1,488 (from 1,495), k.ctx 1,496 (from 1,489), k.server 1,470 (from 1,462), std.sessions 1,498 (unchanged), k.sync 1,140 (new), std.channels 1,287, std.live 680, std.offline 1,193, std.conflicts 846, std.multi 737 (all new); spec map 829 (from 1,081); `spec/std/README.md` 615 (from 144; an index, not a budgeted section). k.ctx, k.store, k.server and std.sessions are within 30 tokens of the cap: their next change needs a split, and RFC 0080 shares k.server's 30 tokens. A task building a realtime app reads k.sync, std.channels, std.live and std.offline, about 4,300 tokens, so the eval's spec slice keeps key lines only. The `keel-api` skill grows by about 60 tokens.

Package sizes (gzip; `tooling/budgets.mjs` rule; today measured, the rest estimated):

| Package | Today | Estimate | `budgets.json` |
| --- | --- | --- | --- |
| `@keel/store` | 2,693 B | +0.45 kB (head, base, key, policy, key lookup) | `3kb` (3,072 B) is crossed; re-base to `3.5kb` with the measured bytes in the commit (default 7) |
| `@keel/ctx` | 2,054 B | +0.15 kB (`online`, sim switch, two event kinds) | `3kb` holds |
| `@keel/server` | 14,390 B (before S2's kernel lane) | +0.08 kB (save reports) | `14.5kb` (14,848 B) holds after S2's estimated +0.2 kB, with about 180 B left for RFC 0080 |
| `@keel/std-sessions` | 6,957 B | +30 B (`net`) | `7kb` holds |
| `@keel/std-sessions/group` | new | 5 kB | `{ "max": "6kb", "platform": "node" }` |
| `@keel/std-channels` / `./server` / `./tools` | new | 1.3 kB / 1.5 kB / 2 kB | `"1.5kb"` / `{ "max": "2kb", "platform": "node" }` / `{ "max": "3kb", "platform": "node" }` |
| `@keel/std-live` | new | 0.5 kB | `"1kb"` |
| `@keel/std-offline` / `./tools` | new | 1.6 kB / 2 kB | `"2kb"` / `{ "max": "3kb", "platform": "node" }` |
| `@keel/std-conflicts` | new | 2 kB | `{ "max": "3kb", "platform": "node" }` |

A client that uses `live`, `subscribe` and an outbox adds about 3.5 kB gzip, plus the std.streams reader.

## Known limits
- **One process.** A save reaches the streams open in the process that saved. A split topology or several instances of one deployable need a broker; the server's existing conflict check is also per process, and `ctx.storage` has no compare-and-set, so two instances over one storage keep last-write-wins. A later RFC (S8 storage) owns both.
- **Key window.** A key is recognized while its entry is in the kept log (`logLimit`, default 256). A resend after more than that many later commits applies again.
- **No optimistic view.** A queued write shows in the outbox panel, not in the live view, until the server applies it.
- **Messages are ephemeral.** A message published while a member is disconnected never reaches it.
- **Identical stale writes.** Two writes that set one field to the same value from one stale read (two votes both writing `6`) commute by state, so no race is reported; concurrent toggles of one item likewise commute while the second user's intent (done) is lost. An app that cares sends the intended value with `'reject'`.
- **Captured orders only.** The race check examines the interleavings a group recorded; exploring other schedules is S5's model checking.
- **Undo.** A rebased entry after an undo since the kept log's start is reported unchecked.
- **Groups are simulated.** Real browsers' sessions cannot be merged into a group without server-side ordering; S4 records groups under simulation only.
- **Connections.** Over HTTP/1.1 a browser holds at most six connections per origin, one per open stream; HTTP/2 lifts it. golden-1 opens one stream per tab.
- **`member` cost.** `member` runs for each open stream of a channel after each save of its stores.

## ADRs
Written with this RFC's acceptance, in `docs/adr/`, numbered by the orchestrator after RFC 0080's:
- **Store heads, write base, write key and the `concurrent` policy** (K1, K2, k.sync). A store counts its changes; a write names the head it saw and a key; a transaction declares `'reject'` (default) or `'rebase'` for concurrent writes. Chosen over version vectors (one authority per store), over runtime commutation checks (timing-dependent refusals) and over more policies (two cover S4).
- **Server push is an invalidation on S3's event stream; writes stay actions** (K3, std.channels). Every open sends `reset`, saves send `saved { store, head }`, and members re-read through their loaders. Chosen over WebSocket (second write path, `ws` dependency, upgrade outside Hono's `fetch`) and over pushing values (second read path).
- **Live views are stores hydrated by re-reads** (std.live). No k.reactive change: a re-run resource passes through `loading`, and a store updates in place, is logged and replays.
- **Connectivity on `ctx.net`, and `save` and `net` observer events** (K3, K4). The online state is part of the `net` capability, with a sim switch that makes `fetch` and open bodies fail; sessions record `net` as an input.
- **Offline writes are an outbox of k.services calls** (std.offline). Typed entries in `ctx.storage`, one FIFO, keys and bases in an explicit `write` field, user resolution `'mine'` or `'theirs'`. Chosen over raw request queues and over client replication of log entries.
- **Races are order checks on rebased entries, over session groups replayed in per-user worker realms** (std.conflicts, std.multi). A race is a rebased entry whose outcome depends on its order against its concurrent entries; groups hold several users' sessions on one timeline, each user in its own realm.

## Open questions
Answered with RFC defaults: transport choice and CRDT choice (below, defaults 2 and 3), the kernel gaps (default 1), privacy of the push (defaults 4 and 5), enforcement (default 6) and the store re-base (default 7). Escalated, because the defaults require it:

1. **New hand-written API shapes.** k.sync: `store.head()`, `tx(t, p, { base, key })`, `transaction(..., { concurrent: 'reject' | 'rebase' })`, `ctx.net.online()`, sim `setOnline`. std.channels: `channel(name, { path, params, message? })`, `channelRoute(channel, { id, stores, member })`, `subscribe`, `publish`. std.live: `live(ctx, origin, channel, params, { read, hydrate })`. std.offline: `outbox(id, api, { limit, maxBytes })`, `Write`, `send(ctx, outbox, origin, endpoint, input, { base })`, `drain`, `resolve(..., 'mine' | 'theirs')`. std.conflicts: `races`, `findRaces`. std.multi: `openGroup`, `replayGroup`. Recommendation: accept as specified. The shapes follow existing ones (`tx` options beside `meta`, `channelRoute` beside `loader` and `action`, the outbox over k.services endpoints), and each new noun has one way in.
2. **golden-1 migration.** golden-1 gains the channel, `live`, the outbox and its panel, four policies and `write` inputs, loses `syncAfter.ts`, and the `golden-1-api` eval gains a hidden acceptance test and the planted-race twin. Recommendation: accept. golden-1 is the app with a shared server store and per-caller writes, and extending its eval keeps one eval per app (default 3).
3. **A new path from one user's browser to another's.** Channel messages carry what one member publishes to every other member's browser. The default stays closed: nothing is published unless a channel declares a `message` schema, secrets are refused (E2602), no publisher identity travels unless the schema holds one, and `member` decides who receives. golden-1 declares no messages. Recommendation: ship messages in std.channels as specified, since "named multi-user channels" is S4's scope and the push needs the same hub; the alternative is std.channels with `saved` only, adding messages in a later RFC.

**Borrow vs build, decided by default 2 and 3 (not escalated).**
- **SSE, not WebSocket.** Measured on Node 22.23.1 and 24.19.0 with the installed Hono 4.13.16: `streamSSE` works through `app.fetch` on every adapter that streams a `Response`, and through a sim net route; Node 22 has a global `WebSocket` client but `EventSource` only behind `--experimental-eventsource`; a WebSocket server on `@hono/node-server` 2.1.6 needs the `ws` package and an `upgrade` listener that `createApp`'s `fetch` cannot reach, and writes over it would bypass the action path. Browsers ship both `EventSource` and streaming `fetch`; std.channels reads with `fetch` so sim and real share code. The transport itself is RFC 0080's to define (Proposal 2).
- **Store-native policies, not a CRDT library.** Keel transactions are already named, pure and typed, so re-applying one on the current state (`'rebase'`) or refusing it (`'reject'`) needs a head and a key, not a merge library. A CRDT document would be a second state model whose merges skip the store's invariants and whose history sessions cannot replay.

**To reconcile with RFC 0080** (orchestrator, before either is accepted): the names of the stream route field and the client reader (`stream`, std.streams); T1 to T5 in 0080's spec text; the order `std-streams` before `std-channels` in `tooling/deps.json`; k.server's 30 tokens of headroom and `@keel/server`'s about 180 B, shared with whatever 0080 adds; E250x and E255x left free for 0080; ADR numbers after 0080's.
