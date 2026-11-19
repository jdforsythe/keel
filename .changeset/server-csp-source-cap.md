---
"@keel/server": minor
---

The CSP report window logs at most 10 reports per source inside its 100 per 60 s. The source is the last `x-forwarded-for` entry, else the peer address; a report with neither counts toward the 100 only. Sources stay in memory for the window and never reach a log record; the `csp` and `dropped` records keep their shape.
