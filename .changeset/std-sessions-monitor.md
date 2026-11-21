---
"@keel/std-sessions": minor
---

`@keel/std-sessions/monitor`: the `monitor` runner counts committed server transactions by name into `sessions.tally`, `monitorRoutes` serves it behind the reader guard, and `keel session monitor <url>` writes `.keel/monitored.json`; E2009 and E2010.
