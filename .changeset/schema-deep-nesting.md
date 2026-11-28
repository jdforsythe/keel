---
"@keel/schema": patch
---

`parse`, `encode` and `piiValues` read a value nested at any depth without recursion, so an `s.json()` value or an open object's undeclared data from a deeply nested JSON body no longer overflows the stack.
