---
"@keel/schema": patch
---

`piiPaths` reads a `format` node through to its base, as `piiValues` does, so a mark inside `s.format(name, base)` is a path.
