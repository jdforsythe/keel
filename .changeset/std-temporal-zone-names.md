---
"@keel/std-temporal": minor
---

`TimeZone` accepts `UTC` and the Zone and Link names of a pinned IANA tz release, spelled exactly as there and kept as written: `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` parse on every host, and `asia/kolkata` is refused with rule `format`. `gen(TimeZone)` draws from the pinned Zone names and `UTC`, so one seed gives the same zones on every host.
