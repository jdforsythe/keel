# RFC 0028: Typed `tx` payloads, log entry `meta`, `undoWhere`

Status: implemented

## Problem
`tx<T>(t: Transaction<T, unknown>, payload: unknown)` (store PLAN D2) accepts any payload, so a wrong payload is found only at run time (backlog 0038). The server proves "this caller committed the last entry" with a side map from log entries to caller tokens (`markLogs`, `tagSince`, `Caller.tags`; finding 0082), then checks and undoes in two steps (`canUndoOwn` then `undo`); the log has no place for that fact and no conditional undo (backlog 0100, k.store part).

## Proposal
1. **Typed call sites.** `tx(t: Transaction<T, P>, payload: P, options?)`, with `P` taken from the transaction only (`NoInfer`), so the payload is contextually typed and excess keys are flagged. A second signature accepts a payload typed exactly `unknown` (wire data, a replayed `entry.payload`) and leaves it to the run-time check, which is unchanged. Any other type that is not assignable to `P` is a compile error.
2. **Log entry `meta`.** `tx(t, payload, { meta })` records `meta: LogMeta` (`{ readonly [key: string]: JsonValue }`, no schema) on the entry, copied through `s.record(s.json())` and frozen. It never enters state. Non-JSON meta returns `err(schema.invalid)` and commits nothing (checked after the payload, before `uses`). `LogEntry` gains `meta?`.
3. **Snapshots.** Snapshots reach clients (`#k-state`), so `snapshot()` drops `meta`; `snapshot({ meta: true })` keeps it for server-side persistence. The log codec accepts optional `meta`, so `restore` keeps the meta of the entries it restores: meta survives exactly when the log does (a state-only snapshot `{ state, log: [], initial }` carries none).
4. **`undoWhere(pred)`.** `store.undoWhere(pred: (entry) => boolean): boolean` undoes the latest entry when `pred(entry)` holds for it. It never undoes an older match: replay without a middle entry reorders the entries after it and may make them fail their invariants. A method next to `undo`, like it.

## Alternatives
- Typed `tx` only, no `unknown` signature: replaying a log or forwarding wire data would need a cast, banned outside `unsafe/`.
- A separate `txUnknown`: two spellings of one write (principle 1).
- `meta` in snapshots by default with the server stripping it: per-sink redaction is opt-in and forgettable (ADR-0015).
- A meta schema per store: meta is caller bookkeeping (audit, attribution), not domain data; JSON is the only constraint the log codec needs.
- Ambient meta from the `owner()` chain (stamp every entry committed in a request scope): a context provider (principle 2). Meta is passed at the call site.
- `undoWhere` removing the latest matching entry anywhere: reorders state; rejected.

## Spec diff
k.store: API (`tx` third argument and typing, `meta?` on entries, `snapshot({ meta }?)`, `undoWhere`); new **Log meta** paragraph; Conformance gains five clauses appended to the last sentence. Map unchanged.

## Conformance diff
Added: `packages/store/conformance/` suites for typed payloads (type-level, `expectTypeOf`; the repo uses no `@ts-expect-error`), meta logging and JSON check, snapshot exclusion and restore round-trip, `undoWhere`.
Changed (needed by proposal 1): `payload.test.ts` passes a generated `string | number | null | { item: string }` to `tx(k.add, ...)`, now a compile error by design; the fix types the property argument `unknown` (`(bad: unknown) =>`), the runtime assertions are unchanged.

## Migration
Call sites passing a statically wrong payload stop compiling; widen deliberate wire data to `unknown`. `Transaction`'s private entry point takes `(payload, meta)`. `snapshot()` output is unchanged for logs without meta. Server: `undoOwn`/`canUndoOwn` can test the latest entry with `undoWhere` in one step; replacing `Caller.tags` needs the caller token at the `tx` call site (k.server follow-up).

## Token impact
k.store 785 -> 1134 of 1,500.
