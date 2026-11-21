---
"@keel/store": patch
---

A keyed write looks up and records its `{ name, key }` in constant time, so a large `keyLimit` no longer costs a scan and a copy of the remembered keys per write.
