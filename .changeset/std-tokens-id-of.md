---
"@keel/std-tokens": minor
---

`tokens(ctx).idOf(token)` returns the id `check` reads from a presented `Secret<string>`, or `credentials.mismatch` for what `check` refuses before it calls `find`, so an app that reads its token rows asynchronously can fetch the row before `check`. It reads no row, digest or clock, and it never returns or logs the secret part.
