---
"@keel/forms": patch
---

A control edited before resume keeps its value and the field takes it when its `Input` sits inside an `If`, `Match`, `For` row or `Boundary`: the island resumes in place instead of failing its claim with E1253.
