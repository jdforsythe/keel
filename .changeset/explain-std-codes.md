---
"@keel/cli": patch
---

`keel explain` of a stdlib code loads the project's std deps first, so a registered rule's code (E2406 and the other E2xxx and W2xxx codes) prints its message and `explain`, as `keel check` reports it.
