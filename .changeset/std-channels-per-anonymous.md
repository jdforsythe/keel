---
"@keel/std-channels": minor
---

Cookieless channel opens count against one shared bound, `perAnonymous` in `std['@keel/std-channels']` (default 64), and never against `perCaller`, so one anonymous client cannot shut out the other first-time visitors.
