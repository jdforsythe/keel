---
"@keel/check": minor
---

E1153 names the guard when an edge of the module `deps` cycle imports a `*.guard.*` file (`module deps cycle through guard <name>: <ids>`, `see` k.guards); `keel explain E1153` points a guard at a module of its own (rfc:0212).
