---
"@keel/cli": minor
---

keel review reads R1013 by flow, as TypeScript narrows `ok` over any name, member or call, and reports R1015: a function whose return type is a type predicate or assertion outside an `unsafe(` call.
