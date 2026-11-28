---
"@keel/store": minor
---

A store keeps `keys`, the `{ name, key }` of its latest `keyLimit` commits made with a `key`: `keyLimit` is a new `store` option (default 1024; a value that is not a positive integer throws), apart from `logLimit`. A write whose transaction and `key` `keys` holds commits nothing and returns `ok`, also after `undo` or a fold removed its entry; the same `key` on another transaction commits. `Snapshot` gains `keys`, at most `keyLimit` of them; `restore` sets it, keeping the latest `keyLimit`, and a snapshot without it restores its log entries' keys.
