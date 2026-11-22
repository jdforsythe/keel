---
"@keel/runtime-dom": patch
---

An island whose claim throws on a ctx a test harness renders with names the thrown error in its E1253 warning, so the harness's E1720 shows the cause; outside dev and a harness the warning still says only "the claim threw".
