---
"@keel/std-timings": patch
"@keel/std-money": patch
---

std-timings keeps at most 256 distinct timing names per ctx (first come, first kept) and registers `timings.recent` once when its module is evaluated again; std-money tests assert `s.register` deduplicates and rejects a different schema (backlog 0135, 0137)
