---
"@keel/testing": patch
---

`settle` and `renderRoute` wait for a route navigation in flight (a loader awaiting a first dynamic `import()`) by macrotask turns that do not count toward the quiet-bound rounds, bounded by a turn count with no timers; a loader that never resolves rejects with `keel.unexpected fire did not settle: <route> still loading`.
