# Review 7: 9836a78f..HEAD plus RFC 0120 and the 0114/0116/0117/0124 amendments

`pnpm ledger --diff`: `ok ledger --diff 1456 items, 1194 verified, 18 unsafe, 21 warnings, 1088 example, 327 probabilistic, 15 exhaustive, 55 proven, 4 monitored, 21 stale, 0 lowered, 0 uncovered`.
All 21 warnings are W1714 (mutation claim stale); none lowered. I ran no test and no root `pnpm check`/`pnpm test` (machine rules). Nothing below is confirmed by execution; each finding is read from the code. RFC 0120 and the 0114/0116/0117/0124 amendments lie before 9836a78f; I reviewed them from their commits (fe5c5037, 075e80b1, 85c02f0d, 31faa5eb, ad5ad74d).

## MAJOR

1. MAJOR: a flush answers `failed` / `offline.storage` for a write the server already committed.
   packages/std-offline/src/internal/flush.ts:61-96 (`put(e.key, out.state...)` then the `catch` at 98-105).
   Scenario: entry A posts, the server answers 2xx, `put(A, "sent")` runs `tx(settle)` (entry removed) and `persist` rejects or hits the 10 s bound. `lost` is true, the catch settles `failed` on a key that no longer exists (a silent no-op) and `done(A, {failed, offline.storage})` resolves the caller of `send`. The page is told the write failed; the server committed it; storage still holds `sending` (loads as `queued`). A page that offers "retry" calls `send` again under a new key and commits twice. The std.outbox "What storage holds" paragraph describes this duplicate only for a doubtful stored `queued`, not for a `sent` answer. Not confirmed by running.
   Smallest fix: in `put`, for state `sent` do not let a persist failure replace the answer: `done(e.key, out)` before the write, and have the catch fail only an entry still present in `c.store.get("entries")`. Add the case to storage-faults.test.ts (storage `['ok','ok','ok','fail']`, route answers 2xx; expect `sent`).

## MINOR

2. MINOR: std.outbox is built and covered but marked `proposed`. spec/std/std.outbox.md:2 and the std.outbox row in spec/std/README.md. The ledger holds 6 verified std.outbox clauses. Rule: spec status updated. Fix: `conformance-covered` in both.

3. MINOR: one sentence stated twice. spec/std/std.offline.md:50 ("An `offline.storage` err's `message` is the outbox `id`, whatever was thrown") repeats std.outbox "Errors", which packages/std-offline/conformance/storage-message.test.ts now cites. Fix: drop the std.offline conformance bullet or the std.outbox sentence, and point the test at the one that stays. The pre-move conformance 11 bullet at std.offline.md:46 still describes `['ok','ok','fail']` as std.offline text; std.outbox bullet 1 covers the same schedule. Check it is not a second statement.

4. MINOR: a stalled write that lands after the second write overwrites it. packages/std-offline/src/internal/persist.ts:10-18, admit.ts. A write that hangs 10 s is "rejected", the entry is failed and the second write stores `failed`; the first write then settles late and stores the older `queued`, so a reload posts it. The spec says a late write "changes nothing in memory" but names no limit for storage. Fix: add the sentence to "What storage holds" (a late write can replace the second one), or serialise writes per outbox. Unconfirmed.

5. MINOR: sentences with no conformance case. std.outbox "A write that settles after those 10 s changes nothing in memory"; the 10 s bound inside a flush and inside `'mine'` (bullet 3 pins only `send`'s admit); "writes the outbox once more" for `'theirs'`; "an entry in hand stays `sending`". test/storageFaults.test.ts covers some as unit tests, not conformance. Fix: add cases, or narrow the sentences.

6. MINOR: `persist` is not async. packages/std-offline/src/internal/persist.ts:10. A `ctx.storage.set` that throws synchronously (not a rejected promise) escapes `put` in flush.ts:35-39 before `.catch` sets `lost`, so it is treated as "any other throw": rethrown, entry left `sending`, not `offline.storage`. Fix: `async function persist` or wrap the call in `Promise.resolve().then`. Unconfirmed.

7. MINOR: `Secret.of` deep freeze (packages/schema/src/Secret.ts:7-18). Safe for every schema kind today (`isJson` admits only plain objects and arrays, so no typed array, Map, Date or class instance reaches it, and cycles are guarded by `seen`). Two edges: `Reflect.get` calls accessor properties, and `isJson` accepts an object with a getter (`Object.values` reads it), so a getter that returns a fresh object each call is read and frozen as a different object than the one a later `reveal` sees; and the freeze would throw on a non-empty typed array if a schema kind for one is added. Fix: skip accessor descriptors (`Object.getOwnPropertyDescriptor`, freeze only `value`), or have `isJson` refuse accessors. Unconfirmed.

8. MINOR: `sig.abort()` on dispose aborts the signal of a read that already settled (packages/std-live/src/live.ts, `sig`). RFC 0114 says "while pending". Fix: abort only when `reading`.

9. MINOR: blank label vs std.text. packages/check/src/rules/blankLabel.ts:38 and packages/std-text/src/textCheck.ts:7 and textFormat.ts:7 hold the same `VISIBLE` class three times. A lone surrogate counts visible in check (`u` flag matches it) but std.text `line` refuses it, though k.a11y says "as std.text `line` defines it". Fix: one shared export, or state the difference.

10. MINOR: stale mutation claims. 21 W1714, including packages/compiler/src/vite.ts, packages/compiler/src/entry/resumeEntry.ts and the std-offline, store, server and check files changed here. Definition of done says mutation at threshold; no run covers these changes.

11. MINOR: store `keyLimit` default 1024 (packages/store/src/store.ts:65) means a snapshot carries up to 1024 keys (up to 64 characters each, about 100 KB), against 256 before. Persisted stores grow on every save; k.sync does not say so. Fix: state the cost in the RFC or the README, or keep the default at the old 256.

12. MINOR: tasks/COVERAGE.md and tasks/STAGES.md are stale at HEAD (spot checks below).
    - COVERAGE.md:7-9 says the committed ledger.json holds 1444 items and 729 clauses; at HEAD it holds 1456 and 741 (6 of them `std.outbox`). The file says "regenerate, do not edit", and the generating script is not in the repo, so nobody can regenerate it.
    - COVERAGE table A: k.privacy 8 (ledger 10), k.a11y 10 (11), k.sync 12 (14), k.reveal 8 (9); "`std.outbox` has no clause list" (ledger 6, all verified).
    - STAGES.md S6 item 4: "0739 ... 0753 ... both lines are still unticked"; tasks/BACKLOG.md:843 and :861 are `[x]`.
    - Held: the convergence values for G1, S2, S3, S4, S5, S7 and S8 (all read from evals/results/*.json); "No apps/golden-3 exists"; the G3 and 0701 claims; the test-file counts for check (75/41), std-offline (17 conformance) and store (37/20).

13. MINOR: the budget raises (server 23.75kb to 24kb, std-offline 3kb to 3.25kb, tooling/budgets.json) rest on "standing authority of 2026-11-17" in commit messages only. ADR 0148 and 0149 do not record it. Measured: server 24,365 B of 24,576 B, std-offline 3,185 B of 3,328 B. Fix: one line in each ADR, since gate changes are the user's call.

## Checked, clean

- Unit 8 (evals/tasks/golden-1-api/acceptance.test.ts): no assertion changed. The diff is the `send`/`drain` call shapes, `ctx.net.route(new URL("/api/*", location.href).href, ...)` replacing the `ORIGIN` pattern, and `dispose: sim.dispose` (the sim's `dispose` is `() => {}`, so the detached reference is safe). The route pattern now depends on the `location` global; the converged eval shows it exists there.
- Unit 3: `logUnwritable(format)` follows the log's format and writes once; `errorName` passes exactly the six names; the Vite plugin writes nothing before `configResolved` (test/viteUnresolved.test.ts pins both sides); `command` has no default and `mode` is `dev` only for `serve`. The E1802 wrapper handling (`unwrap`, spread, call object) reads correctly.
- Unit 4: `secretSegments` marking order is right (sorted `[secret]` first, `??=`, strict `<` for the cut, so the secret wins at a tie and the earliest cut wins); the encoded-separator cut applies only when the table has a secret param, as spec and RFC say; the no-marks case returns the path unchanged through split and join. Freeze: see 7. The k.privacy moves leave each moved sentence once (evidence, E1112 in k.reveal, E1113 in k.privacy Rules and k.api). The dropped "inspect is not a sink" sentence is argued in RFC 0126.
- Unit 6: `keyLimit` validation, `recent`, restore without `keys`, `logLimit: 0` independence and the property model all match k.sync and k.store.
- Unit 7: the check regex equals std.text's `VISIBLE`; conformance pins all five bullet-11 examples and two generated properties.
- Unit 1 (RFC 0120): owner flow, `origin` and no-owner entries failing on load, in-flight owner change, `own` on change; no defect found beyond 1, 4, 6. The std.offline spec edit moves its storage sentence to std.outbox; std.offline README and skill follow.
- Amendments 0114, 0116, 0117, 0124: the std-live signal aborts at 30 s and on dispose (8 aside); `TimeZone` reads only the pinned list; `entryError` gives E2551 for a host-lacking zone; no defect.
- Rule 6 and rule 11 greps over the added lines of src, README, spec and skills: no hit. Changesets present for each package change. No `unsafe` change (18).

## Not reached

No execution of any test or the red-team's zz probes; the cyclic and typed-array freeze cases are read, not run. ADR 0146 to 0151 read only for the budget and decision lines. Generated files (surface.json, `pnpm spec` token counts) not regenerated. COVERAGE tables B and C beyond three packages. No review of the Open counts in STAGES.md.
