---
"@keel/server": patch
---

The `req` path marks a secret route param by position: each segment that stands where a served route has a secret `params` field is `[secret]` whole, whatever spelling the client chose (any escapes, upper or lower case, an escape that does not decode, a `+`, a value the schema refuses), before the request's own values are scrubbed as before.
