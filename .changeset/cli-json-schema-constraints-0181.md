---
"@keel/cli": patch
---

toJsonSchema emits the constraints parse enforces: minimum and maximum for number and int bounds, the safe-integer range for every int, minLength 1 for ids. String length still counts code points in JSON Schema and UTF-16 units in parse; the two agree for strings without astral characters.
