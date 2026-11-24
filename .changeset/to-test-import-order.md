---
"@keel/std-sessions": patch
"@keel/check": patch
---

`keel session to-test` writes the file's imports in the formatter's order, packages first and relative paths from the farthest up, so the file needs no formatting. E1108 for a format that is not registered says to list its package in `deps`.
