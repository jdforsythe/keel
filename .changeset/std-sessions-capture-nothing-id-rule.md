---
"@keel/std-sessions": patch
---

`keel session capture` answers E1056 (exit 1, nothing written) when `sessions.live` is absent, `null`, an `error` or not a `Session`, each with its own message. The session-id rule `^[A-Za-z0-9_-]{1,64}$` is in the `Session` schema, so a group's `users` and the ingest archive meet it too.
