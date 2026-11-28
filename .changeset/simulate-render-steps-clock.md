---
"@keel/testing": patch
---

Inside `simulate`, a harness `settle` on the run's ctx that waits on a loading route with nothing else moving steps the run's sim clock to its next deadline within the horizon, so `renderRoute` renders a page whose first request is delayed; on any other ctx the clock still moves only when the test advances it.
