---
"@keel/std-offline": patch
---

The misuse throws (E1203, E2651, a value no outbox returned, a refused entry) are `defect` calls; a module-level outbox makes its store in a module root; the flush loop recovers a rejected storage write with `attempt` and `try`/`finally`. `unsafe/` keeps the one cast.
