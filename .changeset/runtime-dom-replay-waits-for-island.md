---
"@keel/runtime-dom": patch
---

`resume` replays only the queued events of islands that have resumed; an event in an island a later `resume` call takes waits for that call.
