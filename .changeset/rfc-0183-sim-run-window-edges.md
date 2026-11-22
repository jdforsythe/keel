---
"@keel/testing": minor
---

`simulate`'s `run()` steps the clock to the earlier of the next `after` deadline and the next edge of an offline window in the run's schedule, within the horizon, so after it the net is online unless a window reaches past the horizon. `clock.next()` is unchanged.
