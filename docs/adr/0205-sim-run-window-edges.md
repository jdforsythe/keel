# ADR-0205: k.sim: `run()` steps to the edges of the schedule's offline windows (RFC 0183)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** `simulate`'s `run()` steps only to pending `after` deadlines, which `clock.next()` returns. A schedule's offline window opens and closes on clock timers `next()` leaves out, so a run can stop inside a window with the net offline. The golden-1 scenario tests step past every window by hand.

**Decision.** `run()` advances to the earlier of the next `after` deadline and the next edge (`at` or `at + ms`) of a window in the run's schedule, either within `horizon`. `clock.next()` is unchanged.

**Alternatives.** `next()` counting window edges (changes the clock every waiter reads); a `run({ online: true })` option (a second way to state the schedule); hand-written steps in each test (repeated and easy to get wrong).

**Consequences.** A scenario's `run()` ends past every window within its horizon. k.sim reads `implemented` until its new clause is covered. No new codes.
