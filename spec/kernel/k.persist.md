# k.persist: Storage and durable state
status: conformance-covered

**Storage.** `ctx.storage` keeps Keel's own state (k.data): stores' snapshots and what stdlib packages version through it, never app data. It holds string values by string key, as given (secrets: k.privacy); each operation returns a promise:
- `get(key)`: the value, `null` when absent. `set(key, value)` stores it.
- `read(keys)`: one value per position asked, a repeated key included, `null` for an absent one, as one cut: no `commit` lands between two of them.
- `commit(writes)`: each write is `{ key, expect, value? }`, `expect` a value or `null` (absent). When every key holds its `expect`, each `value` is stored and it resolves `true`; otherwise nothing is stored and it resolves `false`. A write without `value` is a condition only. One key twice throws E1606.

Real: the platform's `localStorage` (on Node, the file `--localstorage-file` names; one process). Sim: in memory per ctx; under a schedule (k.sim) a `read` or a `commit` takes one `storage` step, and a failed `commit` stores nothing. Two `createApp`s on one sim ctx behave as two processes sharing one storage. Shell: k.shell.

**Drivers.** `createCtx({ mode, drivers: { storage?, net? } })` gives a `real` or `shell` ctx each object as that capability, which keeps its contract (`storage` above; `net` k.ctx and k.sync). `@keel/ctx/node` `fileStorage(path)` is a storage driver over a JSON file (`keel dev`'s, k.topology). On a `sim` ctx `drivers` throws E1605, as `schedule` off sim throws E1604: simulation stays the kernel's, so runs replay. Generated entries pass drivers (k.deploy, k.shell); app code reaches them only through `ctx`. A driver that holds connections has `close()`, resolving once they close; the generated entry awaits it after `app.close()`, and any call after it rejects.

**Server saves.** k.server's state rules hold for every process sharing one driver:
- A request restores a factory's stores from one `read` of their keys (`keel.store.<id>`).
- An action's `ok` saves in one `commit`: each changed store's `snapshot({ meta: true })` JSON, `expect` the value it was restored from, and each opened unchanged key as a condition. `false` is 409 `keel.conflict` with nothing saved, so the read-set rule and a save of several stores hold across processes.
- The in-process copy of each `ctx.storage` (one per storage object) only spares parsing a value read again; it decides no conflict, and a `false` commit drops the keys it named.
- `commitStores(ctx, factory, fn)` (`@keel/server`) is that path outside a request, for runners and jobs: one `read`, `fn(S)` returning a `Result`, and on `ok` a `commit` as an action makes, then `save` events `{ kind: 'save', store, head, from }` (k.sync). On `false` it runs `fn` again on a fresh read, at most 3 runs in all, then resolves `err` `keel.conflict`; `err` or a throw saves nothing. `fn` may run more than once, so it calls transactions and no other effect. There is no `caller`.

**Older snapshots.** A stored snapshot outlives the code that wrote it. `restore` of a snapshot whose state parses but whose log names a transaction the store no longer declares, or holds a payload its schema refuses, keeps `state`, `head` and `keys`, takes `state` as `initial`, and keeps no entry. A state the schema refuses stays `restore`'s `err`. Before a deploy, k.compat reports both (E1563, W1564).

**Rules.** E1605 `drivers` on a `sim` ctx (throws) · E1606 one key twice in a `commit` (throws) · E1551 (k.server) also covers `commitStores` outside `*.server.ts`, and reads app files only: no test, tool config (`*.config.*`), or file under `unsafe/`, `.keel/`, `node_modules/` or the root's `packages/` (kernel and stdlib code).

**Conformance.**
- `read(keys)` returns each key's value in the order asked, `null` for an absent key.
- `commit` stores every `value` and resolves `true` when each `expect` matches; with one `expect` stale it stores nothing and resolves `false`; a write without `value` is checked and not stored.
- For generated interleavings of `commit`s from two apps on one sim ctx, the stored values equal a serial order of the commits that resolved `true`, and a `read` never returns a value from between two writes of one `commit`.
- `createCtx({ mode: 'sim', drivers: {} })` throws E1605; a `commit` naming one key twice throws E1606.
- `createCtx({ mode: 'real', drivers: { storage } })` returns `storage` as `ctx.storage`.
- Two `createApp`s on one sim ctx, overlapping actions that read one store and save another: the later save is 409 and the stored values are the earlier one's.
- An action saving two stores whose `commit` resolves `false` stores neither.
- `commitStores` whose `commit` is refused twice then accepted runs `fn` three times and saves once; refused three times it returns `keel.conflict` and saves nothing.
- `commitStores` reports one `save` event per changed store and none when nothing changed.
- `restore` of a snapshot whose log names an undeclared transaction returns `ok`, keeps `state` and `head()`, and leaves `log()` empty and `snapshot().initial` equal to `state`.
- A second ctx on `f` reads a value set through `createCtx({ mode: 'real', drivers: { storage: fileStorage(f) } })`.
- A `commitStores` call and a `loader` call in `packages/p/src/run.ts` are no E1551; the same file at `modules/a/run.ts` is two.
