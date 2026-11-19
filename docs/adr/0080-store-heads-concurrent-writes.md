# ADR-0080: store heads, write base and key, and the `concurrent` policy (RFC 0081)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1, 6 and 7.

**Context.** The server's only conflict check compares the identity of an in-process cache object, so nothing durable says how far a store has moved, a client cannot say which state it acted on, and a write computed from a stale copy lands with 200. A POST retried after a lost response applies twice. Whether a stale write should be refused or applied depends on the transaction: a toggle holds on any state, a full-field edit does not.

**Decision.** k.sync, a new kernel section implemented in `@keel/store`. `store.head()` counts commits and undos; an entry's `id` is the head it produced; `snapshot()` carries `head`. `tx(t, payload, { meta?, base?, key? })`: a write whose `base` is not `head()` is concurrent, and its transaction's `concurrent` declaration, `'reject'` (default) or `'rebase'`, decides. `'reject'` returns `keel.conflict` (409) with `{ store, transaction, base, head }`; `'rebase'` runs the pure transaction on the current state with schema and invariants, and the entry keeps `base`. A `key` that a kept entry holds commits nothing and returns `ok`, checked before `base`. `base` and `key` are entry fields, not `meta`.

**Alternatives.**
- Version vectors, rejected: each store has one authority, so a scalar head is enough.
- More policies (`last-writer`, path-level `merge`), rejected for S4: `'rebase'` already applies the later arrival, and a path merge needs a state diff per write on the request path.
- Refusing non-commuting rebases at runtime, rejected: it needs the state at `base` on every stale write and makes a refusal depend on timing.
- An idempotency header in k.server, rejected: a hidden channel beside the action's input; the explicit `write` field is local.

**Consequences.**
- Writes that pass no `base` behave as before; no existing app changes behavior.
- A log entry holding `base` is a rebased write, so the log records every resolution the server made.
- A key is recognized while its entry is in the kept log (`logLimit`).
- `@keel/store` grows about 0.45 kB and its budget is re-based to 3.5 kB; k.store goes to 1,488 tokens with two restatements trimmed.
