# ADR-0085: races are order checks on rebased entries, over session groups replayed in per-user realms (RFC 0081)

**Status:** accepted (2026-11-10), user decisions D1 and D2, under the WORKFLOW RFC defaults 3 and 6.

**Context.** S4's exit proof is a session captured from two users that replays deterministically and reports a planted race. Replay drives one sim ctx with no server; client stores are module-global and every harness renders into one `document`, so two users cannot share a realm. A `'rebase'` declaration claims a transaction holds on any state, and nothing checks the claim.

**Decision.** `@keel/std-sessions` gains `./group` (std.multi): `openGroup` runs each user in its own worker thread with its own DOM, modules, sim ctx and cookie jar, against one server on one timeline, and returns a `SessionGroup`; `replayGroup` applies all users' inputs in order of `at`, user index and event index. `@keel/std-conflicts` (std.conflicts): `races(snapshot, stores)` rebuilds the state at each rebased entry's `base` and applies its concurrent entries and it in both orders; different results, or exactly one failing order, is a race (arrays of objects with a string `id` compare as sets). `findRaces` replays a group and checks every server store; a race prints as E2701, an unchecked entry as W2702. golden-1's eval plants the race by declaring `editTodo` `'rebase'` in a copy and asserts one race there and none in the shipped app.

**Alternatives.**
- Two users in one realm, rejected: element ids and module-global stores collide.
- Playwright with two browser contexts, rejected: it cannot replay under simulation, and its timing is not reproducible.
- Checking order at runtime, rejected: a request lacks the state at `base`, and a refusal there would depend on timing.
- Splitting std.sessions for the group contract, rejected: moving its Ingest paragraph would re-quote three conformance headers; a new section in the same package changes none.

**Consequences.**
- Groups are recorded under simulation only; real browsers' sessions cannot yet be merged.
- The check sees captured interleavings only; exploring other schedules is S5.
- Identical stale writes and concurrent toggles commute by state and are not reported.
- The worker realm is the exit proof's main risk, so its lane proves it first.
