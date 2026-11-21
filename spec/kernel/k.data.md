# k.data: App data
status: proposed

**Stance.** App data is the records an app keeps for its users: recipes, orders, profiles. The kernel neither stores nor fetches it, as it signs no one in (k.user). It validates what crosses a boundary: a request by its `input`, `params` and `search` schemas, an answer by its `output` schema (k.server, E1554). The app keeps its data in any store through any library, reached from a capability (k.ctx `register`) whose real, shell and sim sides return one TypeScript type. `@keel/std-postgres` is one such capability (std.postgres); a library with no Keel package plugs in the same way.

**The seam.** A data capability is registered in one app file and reached only through its accessor:
```ts
export const notes = register('notes.mongo', { real, shell: real, sim })   // modules/notes/notes.server.ts
const r = await notes(ctx).forOwner(user)                                   // a handler: Result<Note[], E>
```
- The type `T` of `register<T>` is the contract: each side returns it, so `tsc` checks that the library's wrapper, the simulated store and every handler agree. Values in `T` come from schemas; the real side parses what its library returns with them, as std.postgres does for every row.
- The module lists the name in `capabilities` (k.module). A server-only capability lives in a `*.server.ts` file (k.boundary), so no browser bundle holds it and no shell ctx reaches it; its `shell` side is its real side.
- The sim side keeps k.sim's rule: deterministic by its seed and plan, reading no clock, network or device, and settling without a timer. It starts empty for each sim ctx.
- An expected failure is a `Result` `err` with a KeelError code the module owns or a kernel one (`keel.notFound`, `keel.conflict`, `keel.unreachable`), so k.server's status table answers it.

**Handlers.** A loader or action reaches app data with `<accessor>(ctx)` and returns what it read or wrote as its `Result`; it names no `stores` for it. A write that must be atomic is one call of the capability (a database transaction). An action that saves stores (k.persist) and writes app data has two commits that cannot be one: an action writes to one of them.

**Keel's own state.** `ctx.storage`, its `read` and `commit` (k.persist), keep the state Keel versions: store snapshots with their logs, std.jobs queues, std.schedules marks, std.workflows instances, the outbox. A server store holds bounded state the app changes by transactions and reads whole per request (a chart, a setting, a counter); records that grow with use are app data. Heads, conflicts and undo (k.sync, k.store) cover stores; over app data the app keeps its own version column and answers `keel.conflict`.

**Simulation and evidence.** Under sim every capability answers from its sim side, so a run and a `simulate` failure's `SimRun` read the same data again. A session replay starts each sim side empty, as it starts a missing store at `initial` (std.sessions). Data reached any other way is not simulated: a library called outside a capability (an identity source's library included), or a sim side that calls a real store. Keel cannot see such a call: the run reads whatever that store holds, a shrunk `SimRun` may pass when run again, and `explore` and `prove` (k.model, k.prove) reach stores only. The ledger reads rungs from tests (k.ledger) and claims nothing more: a rung earned under sim is evidence about the code with each capability's sim side; a real side holds the rung of the tests that run it against its store.

**Dev.** In `keel dev`, editing an app file that calls `register` loads the server graph again whole, so the registry is empty when the file registers again: no E1602.

**Rules.** E1607 `register` in app code with a name that is not a string literal `<moduleId>.<name>` of its own module (both lowerCamel), or a name another app file registers too (no fix).

**Conformance.**
- An app file at `modules/notes/notes.server.ts` calling `register('notes.mongo', ...)` is no E1607; `register('mongo', ...)`, `register('other.mongo', ...)`, `register(name, ...)` with `name` a variable, and a second file registering `notes.mongo` are each one E1607.
- A capability registered as `register<T>` whose `sim` returns an object missing a member of `T` does not typecheck.
- Under two sim ctxs of one seed, the same calls to an app-registered capability's accessor give equal answers, and a sim ctx made after another sees none of the other's writes.
- A loader whose capability answers `err` `keel.unreachable`, `keel.conflict` or `keel.notFound` is 502, 409 or 404; a value that fails the loader's `output` is E1554.
- Under `keel dev`, editing and saving `modules/notes/notes.server.ts` twice serves the next request with no E1602 and the edited code.
- `capabilities()` lists an app-registered name after its file is imported.
