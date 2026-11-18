---
name: keel-writes
description: "Concurrent and offline writes to Keel server stores: transaction concurrent 'rebase' | 'reject', tx base and write key, keel.conflict 409, @keel/std-offline outbox/send/drain/resolve, @keel/std-conflicts races; E2651, E2701"
---

# Concurrent writes and the outbox

Spec: `pnpm spec k.sync`, `std.offline`, `std.conflicts`.

**Concurrent writes:** `transaction(store, name, schema, fn, { concurrent: 'rebase' | 'reject' })`; `'reject'` is the default. A write carries `base` (the head its writer read); when `base` is not the head, `'rebase'` applies it to the current state (use it when the payload holds no value the writer read: a fresh id, a flip), `'reject'` answers 409 `keel.conflict` with `data.head`. Pass `base` to `tx` with the input's `write`; a repeated write `key` commits nothing again.

**Outbox (`@keel/std-offline`):** `outbox('todos.outbox', endpoints, { module: 'api' })` (module level or in a scope) sends through `service({ module })`, so `output` and `errors` describe the route's `ok` value and err's `error`; endpoint bodies hold `write: Write` and the action passes `{ meta, ...input.write }` to `tx`. `send(ctx, outbox, 'addTodo', { params, body }, { base: view.get('head'), owner })` resolves `sent | queued | conflict | failed`; `owner` is the signed-in user's id, else `''`. `drain(ctx, outbox, { owner })` in a scope flushes that owner's entries on reconnect; another owner's entry, or a stored one with an `origin` or no `owner`, is `failed` with `offline.owner` and never posted. `resolve(ctx, outbox, key, 'mine' | 'theirs')` settles a `conflict` or `failed` entry: `'mine'` resolves the re-send's `OutboxResult` (`false` for no such entry), `'theirs'` `true`. A rejected `ctx.storage` write leaves the entry `failed` with `offline.storage`. E2651 an `s.secret` in an endpoint body.

**Races (`@keel/std-conflicts`):** `races(snapshot, stores)` over a stored server store, or `findRaces(group, { user, serve, stores })` over a replayed session group, reports a rebased write whose order changes the result (E2701): make that transaction `'reject'`, or stop its payload carrying a value read from a stale copy.
