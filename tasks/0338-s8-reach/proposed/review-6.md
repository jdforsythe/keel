# Review 6: de073d1a..HEAD (units 1 to 8)

Method: read each RFC, the spec section and the diff; ran `pnpm ledger --diff` and `node tooling/generate.mjs --check` (ok) and a node one-liner over the zone list. Did not run `pnpm check` or any test (machine rules: no root check/test; no suspected finding needed a test run).

## MAJOR

1. std.text clause 10 has no evidence (confirmed). `pnpm ledger --diff` fails: `E1707 spec/std/std.text.md:33 section std.text is conformance-covered but clause 10 has no evidence`. Clause 10 is the new RFC 0116 bullet (spec/std/std.text.md:33, written `'​'`, `'ㅤ'`, ...). The header of packages/std-text/conformance/invisible.test.ts:1 quotes it with `\u{200B}`, `\u{3164}`, ... so the ledger's text match fails. DoD "ledger not regressed" is not met. Smallest fix: make the two texts identical. Editing the spec bullet to the `\u{...}` spelling is a spec edit and needs no `conformance/**` edit. Rewriting the header would need an rfc:0116 PR.
2. The `offline.storage` fixed message is pinned nowhere (confirmed by grep). The spec (std.offline Write paragraph) does not say the message is the outbox id. Only README.md:19 and the changeset say so. No conformance or unit test asserts `error.message`. The conformance storage stub throws `QuotaExceeded /data/user/secret.db`, but nothing checks that this text stays out of `error.message`. A mutation of `storageError` back to `String(x)` or `stored.error.message` passes all tests. This is a privacy claim ("so a Form can show it"). Smallest fix: one assertion in conformance/storage-fail.test.ts (in an rfc PR) and one test in packages/std-offline/test that `message === outbox id` for the send, resolve and flush paths. Add the sentence to the Write paragraph in the spec.

## MINOR

3. packages/std-offline/src/internal/flush.ts:45-48 (the `await writing` wait). If `ctx.storage.set` never settles (a blocked IndexedDB), the one flush waits on it forever, and every later `send` that joins the running flush never resolves, though its own write finished. Before the fix, those entries would have posted. Not confirmed by running it. This is a liveness trade-off of the design; either bound the wait or record it in the README.
4. packages/compiler/src/entry/RESUME_ENTRY.ts is no longer used by src. Only packages/compiler/test/*.ts use it, since vite.ts now calls `resumeEntry(q.d, mode)`. It is a second way to build the "production" resume entry (P1). Delete it, or keep it only if it is a public export, and then state that.
5. std-temporal `gen` draws from the pinned Zone names (release 2026f). `parse` also requires `Intl` to accept the name. On the Node here (24.19) all 597 names are accepted (confirmed). On an older ICU (Node 22) a newer zone such as `America/Coyhaique` may fail `Intl`, so `gen-roundtrip` can fail on that host. The RFC accepts the `Intl` check but does not address this. The fix is a gen property that filters on `Intl` acceptance, or a note in the README.
6. spec/std/std.channels.md and conformance: the sentence "A route whose `member` refuses `""` holds no cookieless stream" (the RFC's D3) is stated in spec and README but has no test of its own in per-anonymous.test.ts. The earlier `member` denied tests cover `member` before the caps, but not `""`. Low risk.
7. The comment in docs/ARCHITECTURE.md "Production and dev" says `createApp` ... "none reads `NODE_ENV`", while `start` and `nodeEnv()` do. The sentence is true of the four named functions only. Reword it to name `start`.
8. Out of scope but seen: `pnpm ledger --diff` also reports `E1707 spec/kernel/k.reactive.md:30 clause 20 has no evidence` (RFC 0125, not in these units) and 20 stale W1714 claims (already recorded in the ledger commit).

## Units found clean

- 1 (std-offline race): the interleavings hold. `admit` registers `c.writes` before any await and removes the entry before settling. The loop re-reads state after the wait, so a failed entry is skipped. A failed admit calls no flush, so no waiter is left behind. Only finding 3 and the unpinned message (2).
- 2 (RFC 0124): `command` is set at `configResolved` before `load`. Both Vite spawns (`viteRun`, `shellBuild`) set `NODE_ENV=production`. Spec, ADR 0145, changesets and README agree. Only finding 4.
- 3 (std-live): the bound wait is aborted after each read and on dispose, and a late result is dropped because the race has already resolved. The backoff and `again` paths are correct. No findings.
- 4 (ctx dispose): the closure is idempotent. Sim, `drivers.net` and no-window cases return no-ops. std-sessions disposes its two inner real ctxs. `bundleWrite` and the generated entries have no window leak. Property test and conformance are present. No findings.
- 5 (std-text): the regexes and the generator (drops bidi controls, replaces a blank last grapheme with `a`) match the spec. Only finding 1.
- 6 (std-temporal): `generate.mjs --check` is in sync, 344 zones and 253 links, every name is accepted by Intl on Node 24, and `supportedValuesOf` has nothing outside the list. Budget moved from 2.5kb to 5kb on a measured 4,949 bytes: tight, but as the RFC records. Only finding 5.
- 7 (std-channels): `full()` runs in the same turn as `join` (no await between), `leave` is idempotent, and the property test checks counts return to zero. No findings except 6.
- 8 (ARCHITECTURE): only finding 7. No history or ids in docs, spec, README or src comments (grepped the diff).

## Not done

- Did not run `pnpm check` (forbidden by the machine rules) and ran no vitest file. Did not read the std-offline interleave property test line by line, the std-live readBound property, or the cli build-production-mode conformance beyond its header. Did not check the k.shell or std.offline RFC 0120 text (excluded). Mutation scores not checked.
