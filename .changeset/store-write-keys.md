---
"@keel/store": minor
---

A store keeps `keys`, the `{ name, key }` of its latest `logLimit` commits made with a `key`. A write whose transaction and `key` `keys` holds commits nothing and returns `ok`, also after `undo` or a fold removed its entry; the same `key` on another transaction commits. `Snapshot` gains `keys`; `restore` sets it, and a snapshot without it restores its log entries' keys.
