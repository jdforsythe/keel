---
"@keel/std-sessions": minor
---

The recorder runs in a detached reactive scope with its own `onError`: it outlives the component that called `record`, `stop()` ends it, and a `record` after `stop()` starts a fresh one. A failed upload (non-2xx, or a put that rejects or throws) is recorded as `sessions.putFailed`, never an unhandled rejection. `record(ctx, { upload })` throws E2006 unless `upload` is credential-free http(s) on the document's origin; the real `put` checks the same and sends with `redirect: "error"`. Errors the ctx kept before the recorder started are scrubbed of the current `el:` and password field values (blinded to their code when an `el:` field is gone), carry their report time, and are taken once per ctx.
