# RFC 0128: store write keys outlive the undo log

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-18). For backlog 0741 (task 0338, lane B). ADR-0150 records it. Reverses the `keyLimit` alternative RFC 0111 set aside.

## Problem
k.sync bounds the write keys a store remembers by `logLimit`: "the `{ name, key }` of its last `logLimit` commits made with a `key`". Conformance bullet 11 pins it: a key "commits again once `logLimit` later commits with a `key` have passed it". `packages/store/test/keysBound.test.ts` reproduces both halves: with `logLimit: 0`, `tx(push, { v: 1 }, { key: 'k' })` twice commits twice; with `logLimit: 2`, keys `k1`, `k2`, `k3` and then `k1` again commits again.

So a store's idempotency hangs on an undo-history setting. A store that keeps no undo history dedupes nothing, and a shared server store forgets a client's key after 256 keyed writes from other clients, so an outbox entry resent after a long offline spell (std.offline) commits twice. RFC 0111 rejected a separate bound as "a second knob for one idea". The two ideas differ: `logLimit` is how far `undo` reaches, and the key window is how long a retry stays safe.

## Proposal
**Option.** `store(schema, initial, { id, clock?, logLimit?, keyLimit? })`. `keyLimit` bounds `keys` on its own: the store keeps the `{ name, key }` of its last `keyLimit` commits made with a `key`, default 1024. `logLimit` no longer decides dedupe; folding past `logLimit` or a secret leaves `keys` as it is, as it does today.

**`keyLimit: 0`.** Refused. A value that is not a positive integer (0, a negative number, a fraction, `NaN`) makes `store` throw, with the package's existing options error: the `Error` `store <id>: keyLimit <n> is not a positive integer`, the form `logLimit` already uses. A keyed write against a store that remembers no key cannot dedupe, so a zero would quietly turn every `key` into a no-op. The rule is reversible: allowing 0 to mean "keys are ignored" is one branch.

**Snapshots.** `snapshot()` holds `keys`, at most `keyLimit` of them, oldest first; `restore` sets them and keeps the latest `keyLimit`. A snapshot without `keys` restores its log entries' keys, as today. The persisted snapshot of a busy server store carries up to 1,024 keys at the default, about 90 KB by the proposal's measure; a store that needs a smaller snapshot sets a lower `keyLimit`.

**std.offline.** Unchanged text: a resent entry keeps its key, so a committed write is not repeated (k.sync). k.sync now says how long that holds, `keyLimit` keyed writes on the server store, and RFC 0127's std.outbox cites it.

## Alternatives
- `keys` keeps `max(logLimit, 256)`: no new option, still forgets on a busy store, still couples the two.
- Refuse `key` on a `logLimit: 0` store with a new E-code: fixes the first reproduction only.
- `keyLimit: 0` meaning "no dedupe": a store option that silently disables a guarantee its callers rely on.
- Name the option in k.sync only: k.store lists the store's options, and a reader of `store()` looks there.

## Spec diff
k.sync (before 5,459 characters, 1,365 tokens; after 5,878 characters, 1,470 tokens). Write key, the sentence "The store keeps `keys`, the `{ name, key }` of its last `logLimit` commits made with a `key` (k.store), oldest first;" becomes:
```
The store keeps `keys`, the `{ name, key }` of its last `keyLimit` commits made with a `key` (a `store` option, k.store: default 1024; not a positive integer: `store` throws), oldest first;
```
and "`snapshot()` holds `keys`; `restore` sets it (a snapshot without it: its log entries' keys), keeping the latest `logLimit`." becomes:
```
`snapshot()` holds `keys`, at most `keyLimit`; `restore` sets it (a snapshot without it: its log entries' keys), keeping the latest `keyLimit`.
```

k.store (before 5,999 characters, 1,500 tokens; after 5,999 characters, 1,500 tokens). `store(schema, initial, { id, clock?, logLimit? })` becomes `store(schema, initial, { id, clock?, logLimit?, keyLimit? })`. To pay for it, "an undeclared transaction returns `err` with code `store.undeclared`" becomes "an undeclared transaction returns `err(store.undeclared)`", the form the same sentence uses for `schema.invalid`.

## Conformance diff
k.sync Conformance bullet 11 changes meaning. Today it reads:
```
- The same `key` on another transaction commits; a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `logLimit` later commits with a `key` have passed it.
```
New text:
```
- The same `key` on another transaction commits; a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `keyLimit` later commits with a `key` have passed it.
```
The headers of `packages/store/conformance/sync-keys.test.ts` (line 1) and `packages/store/conformance/sync-key.test.ts` (line 1) quote the old bullet, and their cases that count `logLimit` keyed commits change to count `keyLimit` ones. Bullets 13 and 14 are new:
```
- With `logLimit: 0`, a keyed write retried commits once; with `logLimit: 2`, a write keyed `k1` after `k1`, `k2`, `k3` commits nothing under `keyLimit: 8` and commits under `keyLimit: 2`.
- `store` throws for a `keyLimit` of 0, -1 or 1.5; `restore` of a snapshot holding more than `keyLimit` keys keeps the latest `keyLimit`.
```
One `rfc:0128` commit by the `conformance-writer`: the two headers and the bullet 11 cases above, and new `packages/store/conformance/sync-key-limit.test.ts` for bullets 13 and 14.

## Migration
No app source changes. A store that set a small `logLimit` now remembers 1,024 keys, so a retried keyed write that used to commit again commits nothing. A store whose persisted snapshot must stay small sets `keyLimit`. A snapshot restored from older code keeps its keys, cut to the latest `keyLimit`.

## Token impact
k.sync 1,365 to 1,470 tokens; k.store 1,500 to 1,500. `@keel/store` grows about 25 bytes gzip (the option, its check, `recent()` slicing by `keyLimit`): about 3,350 against a 3.5 kb (3,584 byte) budget.

## Choices
Each is the drafter's choice; the operator can reverse any of them.
- C1: the option is `keyLimit`, default 1024.
- C2: `keyLimit: 0` is refused at store creation with the existing options error.
- C3: snapshots carry up to `keyLimit` keys; there is no separate snapshot bound.
- C4: k.sync bullet 11 is reworded to `keyLimit`, in this RFC, so its conformance changes with it.
