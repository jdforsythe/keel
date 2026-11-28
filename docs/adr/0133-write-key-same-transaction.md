# ADR-0133: a write key matches its own transaction and outlives undo and the fold (RFC 0111)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** A write `key` was matched against the entries of the kept log, whatever their transaction. `undo`, `undoWhere` and the fold past `logLimit` dropped the entry and the key with it, so an outbox resend after either applied the write again; and a key reused on another transaction silently dropped that write. Server stores restore from a snapshot per request, so any record of keys has to travel in the snapshot.

**Decision.**
- D1: a `key` matches only a write of the same transaction.
- D2: the store keeps `keys`, the `{ name, key }` of its last `logLimit` keyed commits, oldest first; `undo`, `undoWhere` and the folds leave it.
- D3: `snapshot()` holds `keys`; `restore` sets it, from the log entries' keys when the snapshot has none, keeping the latest `logLimit`.
- D4: k.sync and std.offline state the bound: a resend commits nothing again while the store keeps its key.

**Alternatives.**
- An in-memory key set: lost at each server request.
- A separate `keyLimit`: a second knob for what `logLimit` already bounds.
- Keys scoped to a caller: left to the open owner question on outbox ownership.

**Consequences.**
- A resend after an undo or a fold commits nothing, within the last `logLimit` keyed writes; past that bound it applies again.
- Every snapshot carries `keys`, `[]` when there are none; an older snapshot restores its keys from its log.
- The conformance case that a key commits again after `undo` or the fold flips.
