---
"@keel/store": minor
"@keel/server": minor
---

Store log limit, hashed caller, serializable saves (RFC 0054, backlog 0131, 0148). `store(schema, initial, { logLimit })` keeps at most `logLimit` log entries (default 256): a commit or `restore` past it folds the oldest into the base `snapshot().initial`, so snapshots and saves stay bounded; `undo`/`undoWhere` return `false` past the kept window. Loaders and actions now get `caller` as the base64url SHA-256 of the `keel-caller` token, so stored `meta.caller` never holds the cookie. A save is 409 `keel.conflict` when any store the request opened, changed or only read, was saved since (no write skew), and a factory's stores load in one ordered section (no read skew). Stored snapshots are parsed once per version, not per request. Old snapshots load unchanged and compact on their next save.
