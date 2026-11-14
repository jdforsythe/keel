---
"@keel/std-tables": patch
---

`TableSearch` passes `label` to its `Input` as a getter, so a label given as a getter updates on the same input.
