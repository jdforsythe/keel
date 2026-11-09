---
"@keel/std-sessions": minor
---

The recorder runs in a detached reactive scope: it outlives the component that called `record`, `stop()` ends it, and a `record` after `stop()` starts a fresh one. A failed upload (non-2xx, or a put that rejects or throws) is recorded as `sessions.putFailed`, never an unhandled rejection. `record(ctx, { upload })` throws E2006 when `upload` is not the page's origin: uploads are same-origin, so a recording app mounts `@keel/std-sessions/routes` in its own `node` deployable.
