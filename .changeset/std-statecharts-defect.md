---
"@keel/std-statecharts": patch
---

The declaration-time throws (a chart failing its analysis, an instance key outside its form) are `defect` calls, now carrying their code; a chart declared at module level compiles in a module root. `unsafe/` keeps the two casts.
