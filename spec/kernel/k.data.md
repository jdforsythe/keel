# k.data: App data
status: conformance-covered

**Stance.** App data is the records an app keeps for its users: recipes, orders, profiles. The kernel neither stores nor fetches it, as it signs no one in (k.user). It validates what crosses a boundary: a request by its contract entry's `params`, `search` or `query` and its `body` or `input`, an answer by its `output` (k.contract, k.server, E1554). The app keeps its data in any store through any library, reached from a capability (k.ctx `register`) whose real, shell and sim sides return one TypeScript type. `@keel/std-postgres` is one such capability (std.postgres); a library with no Keel package plugs in the same way.

**The seam.** A data capability is registered in one app file and reached only through its accessor, the file's one export:
```ts
export const mongoNotes = register<NoteStore>('notes.mongo', { real, shell: real, sim })   // modules/notes/mongoNotes.server.ts
const r = await mongoNotes(ctx).forOwner(user)   // in a loader's fn: Result<Note[], E>
```
- The type `T` of `register<T>` is the contract: each side returns it, so `tsc` checks that the library's wrapper, the simulated store and every handler agree. Values in `T` come from schemas; the real side parses what its library returns with them, as std.postgres does for every row.
- The accessor makes a ctx's side at its first call on that ctx, from the side of the ctx's mode, and returns that object on every later call with that ctx.
- The module lists the name in `capabilities` (k.module). A capability that stays on the server lives in a `*.server.ts` file of a module a `node` deployable serves (k.boundary), so no browser bundle holds it and no shell ctx reaches it; its `shell` side is its real side.
- The sim side keeps k.sim's rule: deterministic by its seed and plan, reading no clock, network or device, and settling without a timer. It starts empty for each sim ctx.
- An expected failure is a `Result` `err` with a KeelError code the module owns or a kernel one (`keel.notFound`, `keel.conflict`, `keel.unreachable`), so k.server's status table answers it.

**Handlers.** A loader or action (`loader(contract, id, decl, fn)`, k.server) reaches app data with `<accessor>(ctx)`, `ctx` being `fn`'s last argument, and returns what it read or wrote as its `Result`; its `decl` names no `stores` for it. A write that must be atomic is one call of the capability (a database transaction). Saving stores (k.persist) and writing app data are two commits Keel does not join: an action does one of them.

**Keel's own state.** `ctx.storage`, its `read` and `commit` (k.persist), keep the state Keel versions: store snapshots with their logs, std.jobs queues, std.schedules marks, std.workflows instances, the outbox. A server store holds bounded state the app changes by transactions and reads whole per request (a chart, a setting, a counter); records that grow with use are app data. Heads, conflicts and undo (k.sync, k.store) cover stores; over app data the app keeps its own version column and answers `keel.conflict`.

**Simulation and evidence.** Under sim every capability answers from its sim side, so a run and a `simulate` failure's `SimRun` read the same data again. A session replay starts each sim side empty, as it starts a missing store at `initial` (std.sessions). Data reached any other way is not simulated: a library called outside a capability (an identity source's library included), or a sim side that calls a real store. Keel cannot see such a call: the run reads whatever that store holds, a shrunk `SimRun` may pass when run again, and `explore` and `prove` (k.model, k.prove) reach stores only. The ledger reads rungs from tests (k.ledger) and claims nothing more: a rung earned under sim is evidence about the code with each capability's sim side; a real side holds the rung of the tests that run it against its store.

**Dev.** In `keel dev`, editing an app file that calls `register` loads the server graph again whole, so the registry is empty when the file registers again: no E1602.

**Rules.** E1607, at `keel check`: a call of `@keel/ctx`'s `register` in a file under `modules/<id>/` whose name is not a string literal `<id>.<name>`, `<name>` one lowerCamel segment; or a name another app file registers too, reported at the call in the file whose path sorts later (no fix).

**Conformance.**
- In `modules/notes/mongoNotes.server.ts`, `register('notes.mongo', ...)` is no E1607; `register('mongo', ...)`, `register('other.mongo', ...)`, `register('notes.Mongo', ...)` and `register(name, ...)` with `name` a variable are each one E1607, and a second file registering `notes.mongo` is one E1607, in the file whose path sorts later.
- A `register<T>` call whose `sim` returns an object missing a member of `T` does not typecheck.
- An app-registered accessor called twice with one sim ctx returns one object, made once; two sim ctxs of one seed get two objects, whose `sim` factories received equal `seed`s, and a write through one is not read through the other.
- An API loader returning its capability's `err` `keel.unreachable`, `keel.conflict` or `keel.notFound` answers 502, 409 or 404; one returning `ok` of a value failing the entry's `output` answers 500 and, in dev, an E1554 `diag`.
- Under `keel dev`, editing and saving `modules/notes/mongoNotes.server.ts` twice: the next request to a loader calling its accessor answers with the edited code, and no E1602 is thrown or logged.
- `capabilities()` lists an app-registered name after its file is imported.
