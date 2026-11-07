# ADR-0044: store log limit, hashed caller, and serializable server saves (RFC 0054)

**Status:** accepted

**Context.** Saved store snapshots kept every log entry forever, each with the raw `keel-caller` cookie in `meta.caller`, and every request re-parsed them (red team M7, backlog 0131). Server saves checked only changed stores, so write skew committed. Loads awaited one key at a time, so a request could read a state that never existed (backlog 0148).

**Decision.**
- **Log limit.** `store(..., { logLimit })`, default 256 entries, keeps the latest `logLimit` entries. A commit or `restore` past it folds the oldest into the base (`snapshot().initial`). `undo` and `undoWhere` reach only kept entries and return `false` once none is left. A count, not bytes, keeps undo depth predictable.
- **Caller id.** Loaders and actions see `caller` as the base64url SHA-256 of the cookie token. Persisted meta never holds a usable cookie, and ownership checks compare ids unchanged.
- **Read set.** A commit validates every key the request opened, changed or only read, in one `inOrder` section. Any drift is 409 `keel.conflict`.
- **One cut.** A factory's keys load in one `inOrder` section, so a request sees them as of the same saves.
- **Parse once.** The in-process copy keeps the parsed snapshot per stored version.

**Alternatives.**
- **Compact only in `snapshot()`.** In-memory undo stays O(log), and the memory and storage logs disagree.
- **Byte budget.** Undo depth would vary with payload size.
- **Strip or rewrite meta on save.** That is action at a distance on app data.
- **HMAC.** It needs key rotation for no gain over hashing a random token.
- **Track actual reads.** One missed read path is silent write skew.
- **Pessimistic locks.** An action awaiting I/O would block others.

**Consequences.**
- **Bounded cost.** Snapshots, per-request restore and in-memory undo replay are bounded by `logLimit` per store.
- **Coarser conflicts.** The factory is the unit of conflict: overlapping actions on one factory 409 even when they wrote different stores. Split factories whose stores do not relate.
- **Old data.** Old snapshots load and compact at their next save. Old entries holding raw tokens no longer match any caller, so they fail closed.
