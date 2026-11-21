---
"@keel/server": patch
---

A `req` path longer than a secret route it lines up with is cut at the secret segment, the rest one `[secret]`, whether or not a route matched and on a forwarded path too, so a secret holding a raw `/` leaves nothing in the log. A failed peer forward's `diag` names the thrown error's `name` only, never its message.
