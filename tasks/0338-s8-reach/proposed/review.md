# S8 review (reviewer, 2026-11-15): NO-SHIP until 1-3 are fixed

1. BLOCKING: `prove` reported `proven` for a transaction that breaks its schema: `packages/testing/src/prove/internal/translator.ts` translated `arr[i]` as an unguarded `select` (an out-of-range index never gave `undefined`). Fix running: guard or E1715, an audit of every accepted construct for the same class, the prove-versus-explore property extended.
2. MAJOR: the ledger credited `proven` to any call of `prove`, e.g. inside `expect(...).rejects` (`packages/cli/src/internal/testFacts.ts`). Fix running: only a `prove` the test awaits or returns.
3. MAJOR: Capacitor `commit` looped `Preferences.set` per key (not atomic across a failed write or a kill); Tauri kept new values in memory after a failed `save()`. Fix running: one native write per commit; roll back on failure.
4. Minor, backlog: E1112 reports `reveal(x).length`, `reveal(x).startsWith('a')`, `reveal(x) && y` (the rule matches the spec sentence; the fix is a spec line plus a stop at members and methods that return a number or boolean).
5. Minor: `node:sqlite` needs Node >= 22.13; nothing generated states the floor (being looked at).
6. Minor: Postgres two-connection behaviour ran only on PGlite; the lock order relies on `order by i`; CI's real server is the only proof: confirm the job exists.
7. Minor: `start.ts` `stop` never exited when a close rejected (fix running).
8. Minor: std-jobs leases compare wall clocks of different processes; skew can double-run a job (at-least-once covers it): say so in std.jobs.
9. Minor: `packages/server/README.md` carried RFC and backlog ids (fix running).
Checked and fine: `commit` on sim, file, SQLite, Postgres; `commitStores` (3 runs); leases; workflows record a step effect once; no URL, key or value printed; conformance edits are the recorded ones; changesets; the three new `unsafe` justifications; the four new READMEs.
