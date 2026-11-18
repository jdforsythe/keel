---
"@keel/ctx": minor
"@keel/std-sessions": patch
---

`createCtx` takes `signal`: aborting it removes the window `online` and `offline` listeners a real or shell ctx's own net added, and a ctx made with an aborted signal adds none. `Ctx` and `SimCtx` have no `dispose`, so only the code that made a ctx can end it. The `session` capability's real and shell sinks make their ctx with an aborted signal.
