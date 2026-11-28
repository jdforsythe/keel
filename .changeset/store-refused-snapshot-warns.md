---
"@keel/store": patch
---

A store created while islands resume takes its waiting `#k-state` snapshot only when its schema accepts it; a refused one stays waiting, so `resume` warns E1253 for it, and the store starts from `initial`.
