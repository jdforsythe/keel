# k.store: Store and transactions
status: conformance-covered
**API.**
```ts
export const cart = store(CartSchema, { items: [] })
export const addItem = transaction(cart, 'cart.addItem', AddItem, (st, { item }) => ({ ...st, items: [...st.items, item] }))
```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload, { meta, base, key }?)`; `payload` is typed by the transaction's schema, so a payload of another type is a compile error; one typed `unknown` compiles and is validated at run time. Log: `cart.log()` ordered entries `{ name, payload, at, id, meta? }`; `cart.snapshot({ meta }?)`, `cart.restore(snap)`, `cart.undo()`, `cart.undoWhere(pred)`. `cart.check(state)` returns `Result<T, KeelError<'store.invariant'>>`: ok iff `state` parses with `schema` and every `invariant` holds, without committing or logging. A store exposes readonly `schema`, `id` and `payloads`; a transaction exposes readonly `schema` and `store`. `snapshot()` is `{ state, log, initial, head, keys }`. Heads, a write's `base` and `key`, and `transaction(..., { concurrent })`: k.sync; restoring snapshots older code stored: k.persist.

**Ids and invariants.** `store(schema, initial, { id, clock?, logLimit?, keyLimit? })`: `id` is the stable store id `<module>.<export>`; the compiler fills it from the export name when omitted (runtime default `store.<n>` from a module counter); it keys `state()` in the harness and the `k-state` snapshot. **Registries**: `isolate(scope)` gives a scope its own registry; `store()` registers in, and `stores()` reads, the registry of the nearest isolated scope on the `owner()` chain, else the module registry, so a duplicate live id throws only within one registry (the server isolates each request scope). `invariant(store, fn)` declares a predicate over state checked after every transaction; a violation returns `err` with code `store.invariant` and rolls back; declared once, next to the store. A payload failing its schema returns `err(schema.invalid)`; an undeclared transaction returns `err(store.undeclared)`. Log entry `at` comes from `clock` (default: a counter), never `Date`.

**View stores**. A component seeds a store from loader data by creating it in its body with the data as `initial` and an explicit `id`, through a factory that also returns its transactions (as a `stores` factory, k.server): `const s = listStores(props.data.items)`. The store is owned by the component's scope and disposed with it; each build of the component creates it from that build's data, and at resume it starts from its `#k-state` snapshot (k.resume Stores). After a write, a handler `tx`es the re-read answer into it.

**Log meta**. `meta` is a record of JSON values with no schema, copied and frozen onto the entry; it never enters state, and non-JSON meta returns `err(schema.invalid)` with nothing committed. Snapshots reach clients (`#k-state`), so `snapshot()` drops `meta` from every entry; `snapshot({ meta: true })` keeps it and `restore` keeps the `meta` of the entries it restores. `undoWhere(pred)` undoes the latest entry when `pred(entry)` holds for it and returns whether it did; it never undoes an older matching entry.

**Pure reads.** `snapshotKeys(snapshot)` gives the write keys a `restore` of `snapshot` takes: its `keys` when present, `[]` included (then no key, whatever its log holds), else, when `keys` is absent, its log entries' keys in log order (k.sync). `givenPii(entry)` gives the non-empty strings and numbers under a `.pii()` mark of a committed entry's payload as `tx` was given it (`piiValues`, k.schema), a marked open object's undeclared keys and all under them among them, which the logged payload no longer holds; empty for an unmarked payload schema or an entry this process did not commit. `givenPii(store)` gives the same of the store's state as last given: `initial` at creation, the state a `restore` was given, or the state a commit or undo made. It is held in memory only and never in a snapshot; a session recorder drops these values from later error text (std.sessions).

**Log limit**. A store keeps at most `logLimit` entries (default 256; not a non-negative integer: `store` throws). A commit past it folds the oldest entry into the base `undo` replays from, which `snapshot()` returns as `initial`; `restore` folds a longer log the same way. State is unchanged. `undo` and `undoWhere` reach only kept entries: with none left they return `false` and change nothing.

**Secrets**. `tx` keeps a payload's `s.secret` values; `snapshot()` folds every entry up to the last holding one into `initial`. `store()` throws E1303 on a state schema holding `s.secret`. A revealed value is plain data (k.privacy).

**Ownership.** A component declares `uses: [addItem]`, bound to the declaring scope (`owner()`); `tx` consults the declarations of the calling scope and its ancestors, and a caller with none in its chain is unrestricted. Calling an undeclared transaction from a component is E1301; loaders and actions (k.router) run outside component scopes and are unrestricted.

**Rules.** E1302 `ctx` or global access inside a transaction function · E1303 `s.secret` in a store's state schema, or a `reveal` call in a transaction function · E1304 a `tx` call in a component file that runs while the component builds: in the component function's body outside any nested function, or in a function that is a `For`, `If`, `Match`, `Case` or `Boundary` child (k.component Build); fix: create the store with the data as `initial` (View stores), or call `tx` in an event handler. Partial (static): skips unresolved schemas, chains past 8 consts, `reveal` in imported helpers; E1304 does not follow a call.

**Conformance.**
- Transactions are deterministic for equal inputs.
- Log replay reproduces state.
- Undo is exact inverse.
- Snapshot round-trips through JSON.
- `restore` replaces the base `undo` replays from with the snapshot's `initial`.
- Of two sibling scopes, the one declaring `uses` is restricted and the other is not.
- `stores()` lists stores whose owning scope is live and drops one on disposal.
- A duplicate live id throws.
- Two isolated scopes each hold a live store with the same id, `stores()` under each lists only its own and outside both lists neither.
- `check(state)` returns ok iff every invariant holds and never changes state or log.
- `store.schema` parses every state the store accepts and `transaction.schema` parses every payload `tx` accepts.
- A payload not assignable to the transaction's payload type is a compile error and an `unknown` one compiles.
- `tx` with `meta` logs it on the entry and leaves state as without it.
- Non-JSON meta is `schema.invalid` and changes nothing.
- `snapshot()` entries carry no `meta`, and `restore(snapshot({ meta: true }))` reproduces the log with its meta.
- `undoWhere(pred)` undoes exactly when the latest entry satisfies `pred` and otherwise changes nothing.
- After more than `logLimit` commits, `log()` holds the latest `logLimit` entries, replaying them from `snapshot().initial` reproduces state, and `undo()` returns `true` exactly `logLimit` times.
- `restore` of a snapshot whose log exceeds `logLimit` keeps its state and its latest `logLimit` entries.
- An effect reading `stores()` reruns when a store is created and when its scope is disposed.
- `payloads` maps each transaction declared on a store to that transaction's `schema` and holds no other name.
- A payload's `s.secret` value is `reveal`able in `log()`; `snapshot()` then holds no secret and restores the same state.
- E1303 fires on a nested `s.secret` in a state schema and on `reveal` in a transaction function, not on clean twins.
- `store()` throws E1303 on a state schema with a nested `s.secret`, not on its clean twin.
- E1304 fires on `tx` at the top of a component body and in a `For` row function; not on one in an `onClick` arrow, an `effect` callback, or a top-level helper the body calls.
- A page component creating `store(S, { items: props.data.items }, { id })` in its body shows the loader's items under `renderRoute`, a click handler's `tx` on it updates the page and `state()`, and `resumeDocument` of its `createApp` document gives `state()` for that id equal to the server's.
