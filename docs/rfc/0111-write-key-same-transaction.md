# RFC 0111: a write key matches its own transaction and outlives undo and the fold

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0502. ADR-0133 records it.

## Decisions
- D1: a write `key` matches only a write of the same transaction. The same `key` on another transaction commits as usual.
- D2: a store keeps `keys`, the `{ name, key }` of its last `logLimit` commits made with a `key`, oldest first. `undo`, `undoWhere` and the fold past `logLimit` or a secret leave it as it is, so a key outlives its entry.
- D3: `snapshot()` holds `keys` (always; `[]` when there are none). `restore` sets it, from the snapshot's log entries when the snapshot has none, keeping the latest `logLimit`. Server stores restore from a snapshot per request (k.persist), so the key set lives in the snapshot or nowhere.
- D4: the bound is stated where a caller relies on it: k.sync names `logLimit`, and std.offline says a resend commits nothing again while the store keeps that key.
- D5: the conformance case "a `key` held only by an entry that `undo` removed, or that folded out of the kept log, commits again" flips.

## Problem
Read on `jdforsythe/test-impl` at `e11d5981`.

k.sync says "When an entry in the kept log holds that `key`, `tx` commits nothing and returns `ok`". `packages/store/src/store.ts:132` does exactly that, `rows.some((r) => r.entry.key === key.value)` over the kept rows. Three gaps follow.

- `undo` and `undoWhere` drop the row and the key with it: `tx(inc, {}, { key: 'K' }); st.undo(); tx(inc, {}, { key: 'K' })` applies twice. An outbox resend after a compensating undo applies the write again.
- The fold past `logLimit` drops the row: with `logLimit: 3`, a keyed write followed by four more writes is forgotten, and its resend applies again.
- The match ignores the transaction: a `reset` sent with an earlier `inc`'s key returns `ok` and commits nothing.

std.offline promises "a write the server already committed commits nothing again", with no bound. A key set held in memory beside the store would not help a server store: k.persist restores each request's stores from `ctx.storage`, so the key set must be in `snapshot()`.

## Proposal
**Store.** Beside its rows the store holds `keys: { name, key }[]`. A commit with a `key` appends `{ name: t.name, key }` and drops the oldest past `logLimit`. `tx` with a `key` returns `ok(current)` and commits nothing when `keys` holds `{ name: t.name, key }`; the check stays where it is, after `uses` and before `base`. `undo`, `undoWhere`, the fold and `snapshot()`'s secret fold leave `keys` alone. A refused or matched `tx` appends nothing.

**Snapshot.** `Snapshot<T>` gains `readonly keys: readonly { readonly name: string; readonly key: string }[]`. `snapshot()` and `snapshot({ meta: true })` both hold it. `restore` parses `keys` as an optional array of `{ name: s.string(), key: keySchema }` (a wrong shape is `restore`'s `err` `schema.invalid`); when it is absent, `restore` takes the `{ name, key }` of each log entry that has a `key`, in order, before any fold or drop. Either way it keeps the latest `logLimit`. A snapshot that k.persist's Older snapshots rule restores by its `state` keeps its `keys` too.

**Saves.** A matched `tx` changes nothing, so its store is not a changed store and k.persist saves nothing for it; a resent action answers `ok` with the current state, as it does now.

**Size.** At most `logLimit` pairs per store (default 256). A store written without keys holds `[]`: 11 bytes of JSON in each stored or `#k-state` snapshot.

## Alternatives
- Keys in memory beside the store: lost at every server request, which restores from storage.
- A separate bound (`keyLimit`): a second knob for one idea; `logLimit` already bounds what the store remembers.
- Match keys across transactions, as the code does now: a stale key on a different write silently drops that write.
- Scope keys to a caller, so a key matches only the same caller's writes. Keys are client-chosen and store-global, so one caller could pre-empt another's key; this belongs to the open owner question on outbox ownership (backlogs 0501 and 0509) and is not decided here.
- `keys` only under `snapshot({ meta: true })`: keeps it off `#k-state` at the cost of two snapshot shapes; entry keys already reach clients, so nothing new is exposed.

## Spec diff
k.sync, the Write key paragraph, whole new text:

```
**Write key.** `key` (1 to 64 characters) names one write across retries. The store keeps `keys`, the `{ name, key }` of its last `logLimit` commits made with a `key` (k.store), oldest first; `undo`, `undoWhere` and folding past `logLimit` or a secret leave it as it is. When `keys` holds the transaction's name with that `key`, `tx` commits nothing and returns `ok` with the current state; the same `key` on another transaction commits as usual. `key` is checked before `base`. The entry keeps `key`. `base` and `key` are entry fields, not `meta`, so `snapshot()` keeps them. `snapshot()` holds `keys`; `restore` sets it (a snapshot without it: its log entries' keys), keeping the latest `logLimit`. A `base`, `key` or `keys` of the wrong type is `schema.invalid`.
```

k.sync Conformance, bullet 6 (same position), whole new text:

```
- `tx` with a `key` that `keys` holds for its transaction returns `ok`, commits nothing and leaves `head()` unchanged, also when its `base` is stale.
```

k.sync Conformance, appended as bullets 11 and 12:

```
- The same `key` on another transaction commits; a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `logLimit` later commits with a `key` have passed it.
- `keys` survives `snapshot()`, a JSON round trip and `restore`; a snapshot without `keys` restores its log entries' keys.
```

k.sync: 4,711 to 5,459 characters.

k.store, the API paragraph after the code block, whole new text (one change: `keys` in the snapshot shape):

```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload, { meta, base, key }?)`; `payload` is typed by the transaction's schema, so a payload of another type is a compile error; one typed `unknown` compiles and is validated at run time. Log: `cart.log()` ordered entries `{ name, payload, at, id, meta? }`; `cart.snapshot({ meta }?)`, `cart.restore(snap)`, `cart.undo()`, `cart.undoWhere(pred)`. `cart.check(state)` returns `Result<T, KeelError<'store.invariant'>>`: ok iff `state` parses with `schema` and every `invariant` holds, without committing or logging. A store exposes readonly `schema`, `id` and `payloads`; a transaction exposes readonly `schema` and `store`. `snapshot()` is `{ state, log, initial, head, keys }`. Heads, a write's `base` and `key`, and `transaction(..., { concurrent })`: k.sync; restoring snapshots older code stored: k.persist.
```

k.store, the Ids and invariants paragraph, whole new text (tightened to pay for `keys`: "it is declared once" becomes "declared once"):

```
**Ids and invariants.** `store(schema, initial, { id, clock?, logLimit? })`: `id` is the stable store id `<module>.<export>`; the compiler fills it from the export name when omitted (runtime default `store.<n>` from a module counter); it keys `state()` in the harness and the `k-state` snapshot. **Registries**: `isolate(scope)` gives a scope its own registry; `store()` registers in, and `stores()` reads, the registry of the nearest isolated scope on the `owner()` chain, else the module registry, so a duplicate live id throws only within one registry (the server isolates each request scope). `invariant(store, fn)` declares a predicate over state checked after every transaction; a violation returns `err` with code `store.invariant` and rolls back; declared once, next to the store. A payload failing its schema returns `err(schema.invalid)`; an undeclared transaction returns `err` with code `store.undeclared`. Log entry `at` comes from `clock` (default: a counter), never `Date`.
```

k.store: 5,999 to 5,999 characters.

k.persist, the Older snapshots paragraph, whole new text:

```
**Older snapshots.** A stored snapshot outlives the code that wrote it. `restore` of a snapshot whose state parses but whose log names a transaction the store no longer declares, or holds a payload its schema refuses, keeps `state`, `head` and `keys`, takes `state` as `initial`, and keeps no entry. A state the schema refuses stays `restore`'s `err`. Before a deploy, k.compat reports both (E1563, W1564).
```

k.persist: 5,246 to 5,254 characters.

std.offline, the `drain` paragraph, whole new text:

```
`drain(ctx, outbox)`, inside a scope, loads the stored outbox (`sending` entries become `queued`), flushes, and flushes again on each reconnect until the scope is disposed. A resent entry keeps its key, so a write the server already committed commits nothing again while the store keeps that key: its last `logLimit` keyed writes (k.sync).
```

std.offline: 4,766 to 4,831 characters, before RFC 0112 changes the same file.

## Conformance diff
One `rfc:0111` commit by the `conformance-writer`:
- `packages/store/conformance/sync-key.test.ts:1`: the `// Spec:` line quotes bullet 6's new text. Line 34: the test name follows it; the body is unchanged (one transaction).
- `packages/store/conformance/sync-key.test.ts:107-119` flips: after `undo`, the same `key` on `push` returns `ok`, commits nothing and `items` stays `[]`; with `logLimit: 1`, a keyed write then an unkeyed one, the same `key` commits nothing (`items` `[1, 2]`); after one more keyed write under another key, the first `key` commits again. The test name becomes bullet 11's text.
- New `packages/store/conformance/sync-keys.test.ts`, citing bullets 11 and 12: the same `key` on a second transaction of the store commits; `keys` holds at most `logLimit` pairs, oldest first, from keyed commits only; `restore(JSON.parse(JSON.stringify(snapshot())))` keeps `keys`, and a matching retry on the restored store commits nothing; a snapshot without `keys` restores its log entries' keys; an entry whose payload holds an `s.secret` folds out of `snapshot()` and its key stays in `keys`; a `keys` of the wrong shape is `restore`'s `schema.invalid`.
- `packages/std-statecharts/conformance/fixtures.ts:2`: the assumption comment names `keys` in the snapshot shape (comment only; the fixture spreads `snapshot()`, so it already carries it).

No other conformance file changes: `undo.test.ts` and `undo-where.test.ts` compare states, or two snapshots of one history, and the literal snapshot in `packages/std-sessions/conformance/group-replay.test.ts:21` is a `restore` input, which may omit `keys`.

## Migration
None for app code: `keys` is new, `restore` accepts a snapshot without it, and a stored snapshot takes its keys from its log on the next request. A test that compares `snapshot()` with a hand-written object adds `keys: []`. A retry that relied on an undone or folded write applying again now commits nothing; nothing in the repo does.

## Build order
1. Orchestrator: the spec diff (applied). The `conformance-writer`: the conformance diff.
2. A store lane owns `packages/store/src/store.ts`, `packages/store/src/types/Snapshot.ts`, a key-pair type file if it needs one, `packages/store/test/**`, `packages/store/README.md` and a changeset (`@keel/store` minor: `Snapshot` gains `keys`). It runs `check`, `build`, the store suite and the std-offline, std-conflicts and std-statecharts suites once, then `pnpm budgets` (each `#k-state` snapshot grows by `"keys":[]`).
3. Orchestrator: `.claude/skills/keel-writes/SKILL.md:10` (a repeated key commits nothing while the store keeps it, per transaction); ledger, backlog 0502 closed, HANDOFF. The std-offline README line "A resent entry keeps its key..." takes the bound in RFC 0112's std-offline lane, which owns that file.

## Token impact
k.sync 1,178 to 1,365 tokens; k.store 1,500 to 1,500; k.persist 1,312 to 1,314; std.offline 1,192 to 1,208. The map is unchanged.
