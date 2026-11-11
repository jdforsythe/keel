# ADR-0103: `ctx.storage` gains `read` and `commit`, and drivers replace implementations per ctx (RFC 0085)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 1, 2 and 6.

**Context.** `ctx.storage` had only `get` and `set`, so k.server's read-set rule compared in-process copies and a save of several stores was not atomic across keys. Two replicas over one storage kept last-write-wins, and std.jobs could lease one job twice. Production storage was a `localStorage` file one process owns, with no way to choose another backend. Runners and jobs had no kernel path to save a server store.

**Decision.** k.persist. `ctx.storage.read(keys)` returns several values as one cut; `commit(writes)` stores every `value` only when each key holds its `expect`, a write without `value` being a condition. `createCtx({ drivers: { storage?, net? } })` gives a `real` or `shell` ctx another implementation of that capability; on a `sim` ctx it throws E1605. An action's save is one `commit` over the changed snapshots and the opened keys, so the 409 holds for every process sharing a driver. `commitStores(ctx, factory, fn)` gives runners and jobs the same path, with at most 3 runs on a refused commit. Real, shell and sim each implement `read` and `commit`; under a k.sim schedule each is one storage call.

**Alternatives.**
- A database API beside `ctx.storage`, rejected: a second storage path, and jobs, schedules and workflows would stay on the file.
- Keeping the in-process conflict check, rejected: correct for one process only.
- Replacing `get` and `set` with `read` and `commit` everywhere, rejected: single-writer state would carry a precondition it does not have.
- Drivers on a `sim` ctx, rejected: simulation and replay must stay deterministic and the kernel's.

**Consequences.**
- std.db and the shell packages are drivers; server stores, job queues, schedule marks and workflow stores move together.
- Two `createApp`s on one sim ctx stand for two processes sharing storage in tests.
- `commitStores` callers must keep `fn` to transactions, since it can run more than once.
- E1605, E1606 and E1551 (now naming `commitStores`) enforce the rules.
