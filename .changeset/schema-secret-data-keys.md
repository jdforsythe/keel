---
"@keel/schema": patch
---

A `Secret` keeps the node it was sealed under, and the internal `secretValues` reads a secret's value beside that node: a record's keys, a `json` value's keys and an object's undeclared keys are given with its strings and numbers, and a declared field name is not. A value no union variant or member fits is read whole.
