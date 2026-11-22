---
"@keel/ctx": patch
"@keel/testing": patch
---

`simulate`'s `run()` settles only once no `ctx.net` route is still answering, so a route forwarding to a server on another ctx (real I/O) has answered when `run()` resolves; while one is in flight with nothing moving, the run's clock steps as under a harness render.
