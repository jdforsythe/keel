---
"@keel/ctx": patch
---

Capabilities resolve lazily per ctx (RFC 0025), so creating a ctx before register(capability) no longer throws.
