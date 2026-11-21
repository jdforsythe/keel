---
"@keel/reactive": patch
---

The README states that a retry follows only the sources the throwing run read, so a computed that throws before reading any source keeps its error until it is disposed.
