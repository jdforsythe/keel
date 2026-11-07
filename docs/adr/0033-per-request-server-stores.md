# ADR-0033: Per-request server stores through named factories; caller on `tx` meta (RFC 0044)

**Status:** accepted

**Context.** A module-level store written by server code was one instance per process, so overlapping requests saw each other's half-done writes (backlog 0054, 0072). Undo was scoped to the caller by a side map that tagged entries committed during an action's synchronous run and found the caller up the `owner()` chain (`undoOwn`, `canUndoOwn`, `markLogs`, `tagSince`; backlog 0102), which is ambient state and loses entries committed after an `await`. `Transaction.payload` duplicated `Transaction.schema` (freeze review §2 row 10).

**Decision.**
- **Factories, named where used.** `loader({ ..., stores })` and `action({ ..., stores })` name a factory `(ctx) => S` that creates stores (explicit ids) and their transactions; `fn` gets `stores: S` and `caller: string`.
- **One instance per request.** The server runs each named factory once per request in an isolated child scope of the request scope; no instance is shared or outlives its request.
- **Persistence.** Each factory store restores from `ctx.storage` `keel.store.<id>` (`snapshot({ meta: true })` JSON). An action's `ok` saves changed stores; `err` or a throw saves none. A write-through in-process copy per key gives an optimistic check: a store saved by another request since this one restored it makes the save 409 `keel.conflict` and saves nothing.
- **Caller at the call site.** `caller` is the `keel-caller` cookie token (minted on a cookieless write), else `""`. Apps write `tx(t, p, { meta: { caller } })` and undo with `undoWhere((e) => e.meta?.caller === caller)`.
- **Deleted.** `undoOwn`, `canUndoOwn`, `markLogs`, `tagSince`, `LogMark`, `Caller.tags`, `callers`, `ownCaller`, `createApp({ expose })`, `Transaction.payload`.
- **Visibility.** Factory stores never enter `#k-state` or inspect `stores`; the client router answers a loader or action naming `stores` with `keel.unexpected`.

**Alternatives.**
- **Compiler-lowered module stores resolved per request.** Needs ambient instance lookup across `await` (`AsyncLocalStorage` or the owner chain): a context provider.
- **A module `createStores` convention.** Loaders and actions would import the factory for its type anyway.
- **A per-store lock.** Blocks writers behind the slowest action; a hung action blocks the store.
- **Keeping `undoOwn(store, caller)`.** A second way to call `undoWhere`.

**Consequences.**
- **Node storage.** A node deployable needs a working `ctx.storage`; on Node the real ctx uses `localStorage`, so the golden-1 `api` script runs with `--experimental-webstorage --localstorage-file=.api.storage`.
- **Whole-log persistence.** Every save writes the full snapshot with its log; logs grow with writes until a compaction story exists.
- **One process.** The conflict check is per process, matching k.server Topology (local only).
- **Tests.** Tests calling `fn` directly pass `{ caller, stores }` with stores built by the factory inside a scope; server tests seed and read `ctx.storage`.
