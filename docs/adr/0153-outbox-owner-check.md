# ADR-0153: std.offline: the action behind an outbox endpoint refuses a write of another owner (RFC 0131)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** An outbox entry's `owner` is a string the page gives, and the caller cookie is one per browser, shared by every tab. After a sign-in in a second tab, the first tab's flush posted the previous user's queued writes, and the server committed them under the new user's caller.

**Decision.**
- D1: `Write` holds `owner`, and a flush sends each entry's owner in `body.write`.
- D2: `writeFor(write, owner)` from `@keel/std-offline` returns the write's `{ key, base }` when its owner is `owner`, else err `offline.owner`; the action passes the owner its module gives the request's caller, `""` for no one, and returns the err, so nothing is saved.
- D3: a flush settles an `offline.owner` answer as `failed` with `offline.owner`; the entry is never posted again.
- D4: the spec text lives in the std section std.outbox-owner; no kernel section changes.

**Alternatives.**
- The kernel's caller id as the owner: one per browser, unchanged at sign-in.
- A kernel check of every write: the kernel has callers, not accounts.
- A cross-tab signal only: not ordered with a fetch in flight, and silent when the sign-in runs no script.

**Consequences.**
- A queued write commits only under the owner who queued it, for every action that uses `writeFor`; an action that spreads `input.write` unchecked is a stated limit.
- A committed write resent after the owner changed is reported `failed`.
- The server deploys before the client; an older client's writes fail on the missing `owner`.
- `@keel/std-offline` grows about 115 B against 143 B free; `@keel/server` does not change.
