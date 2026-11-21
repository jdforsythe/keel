---
"@keel/std-statecharts": minor
---

`instance(chart, key)` compiles a chart again in the calling scope as the store `<id>:<key>`, with one transaction `<id>:<key>.<event>` per event, disposed with the scope; a key outside 1 to 64 characters of `[A-Za-z0-9._-]` throws. Type `ChartInstance`.
