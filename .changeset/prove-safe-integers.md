---
"@keel/testing": patch
---

`prove` holds every integer of the post-state within ±(2^53 − 1), the range `s.int` parses. A transaction that writes `n + 1` into a field with no bound and no guard rejects E1716 with the state at the edge (`{"n":9007199254740991}`) under the line `<tx> leaves the safe integer range from this state; bound the schema or guard it`. Give the field a `max` and guard the write (`n < 9 ? n + 1 : n`). `n * 2` and `n + p.by` on unbounded integers get the same line. A state or payload array holds at most 2^32 − 1 items, so a length written to an integer field proves.
