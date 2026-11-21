---
"@keel/check": patch
---

E1111 reads a schema object changed after its literal as unread. E1303 reads `reveal` through helpers, re-exported reducers and a re-exported `reveal`. E1567 reads `service` through a namespace import. E1802 reads a label of a lone surrogate as blank.
