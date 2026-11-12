# k.sync: Heads, concurrent writes and connectivity
status: conformance-covered

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

**Rules.** None. `keel.conflict` is a KeelError code (k.errors) that k.server answers 409.

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
