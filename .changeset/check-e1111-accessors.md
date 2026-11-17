---
"@keel/check": patch
---

E1111 reads a getter, setter or method in a schema's object literal as a part it cannot read statically, so `params: s.object({ get token() { return s.secret(s.string()) } })` reports `route params not readable statically`.
