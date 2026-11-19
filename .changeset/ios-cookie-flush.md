---
"@keel/std-capacitor": patch
---

On iOS a response that sets a cookie resolves after the session's cookie store is written to disk, so a cookie with a lifetime outlives a force-stop that follows at once.
