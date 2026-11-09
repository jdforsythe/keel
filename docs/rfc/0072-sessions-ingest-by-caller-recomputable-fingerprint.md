# RFC 0072: sessions ingest by caller, and a fingerprint recomputable from the session

Status: accepted (ADR-0061, 2026-11-09). WORKFLOW RFC defaults applied: 4 (privacy by default), 6 (kernel-level enforcement over documentation), 2 (one way per thing). No new hand-written user-facing API shape, nothing weakens privacy or auth, and no golden app needs a migration, so the orchestrator accepts it.

## Problem
Backlog 0225 and 0226 (red-team of 0093) and lead 1 of task 0225:
1. **0225, ingest flood.** `sessions.ingest` takes anonymous POSTs. Past 64 fingerprints or 4 MiB, `addSession` evicted the fingerprint with the oldest `last`. One real POST followed by 20 POSTs of about 240 KiB with distinct error codes left no real session in the archive. Each write also re-encoded the whole 4 MiB archive once per eviction step and again in the invariant.
2. **0226, fingerprint spoofing.** The fingerprint hashed `data.at` before redaction and the route the error fired under, and neither is in the session when a `nav` precedes the error or an `error:` entry masks `data.at`. In those cases `ingestFingerprint` kept the posted 12-hex value, so a client could file a session under another bug's fingerprint, push its 5 sessions out and inflate its `count`.
3. **Lead 1, replay with a store missing from `state`.** `replay` seeded only the stores the base `state` names. Any other live store kept whatever an earlier test or replay left, and a replay's changes to it were never put back. `minimize` on such a session gave different results from run to run.

## Proposal
### 1. Sessions filed by caller (0225)
- **Archive entry.** Each kept session is `{ caller, bytes, session }`. `caller` is the action's `caller`, the same hash the `sessions.reader` guard sees (`""` for anonymous). `bytes` is the session's encoded JSON length, measured once when it is filed. Per fingerprint `count`, `first` and `last` are unchanged.
- **Bounds and who loses.** Each bound removes the oldest session of one caller:
  - **Past 5 in a fingerprint.** The caller holding the most sessions there loses its oldest. Ties go to the caller whose oldest session is older. With one caller this is "newest 5".
  - **Caller quota: 1 MiB of `bytes` in 16 fingerprints.** The writer's own oldest sessions go, by fingerprint `last`, then key, then arrival. The new session never goes.
  - **Past 64 fingerprints or 4 MiB.** The caller with the largest share loses its oldest session. Share is bytes, then fewest sessions, then caller key. A caller other than the writer never loses a session in the fingerprint this write filed into. The new session never goes.
  - A fingerprint left with no session is removed.
- **Incremental bytes.** The archive size is an upper bound from each kept session's `bytes` plus fixed per-entry and per-session overheads, so a write is linear in the number of sessions and never re-encodes the archive. The invariant `sessions.capped` checks the same bound and the caller quota. A property test shows the bound covers the real JSON.
- **Listing.** `sessions.list` returns `Listing`: per fingerprint `count`, `first`, `last` and the sessions. Callers and byte counts stay on the server (default 4). `keel session ingest` reads the same shape as before.

### 2. A fingerprint recomputable from the session (0226)
- **Error event.** The `error` `SessionEvent` gains `route: string`, the route id current when the error fired: the latest `nav`'s route, else the base route. It is required, and E2002 stays strict.
- **Hash.** The fingerprint is 12 hex of sha256 over the first `error` event's `code`, its `data.at` as recorded (after redaction) and its `route`. With no error event it uses `''`, `''` and the base route id, as before. One internal function computes it from a session, and the recorder, `replay`, `minimize` and `sessions.ingest` all call it (default 2).
- **Ingest.** `sessions.ingest` recomputes `fingerprint` and `error` (the first error event's error) from `events`. It never reads the posted values: a different posted value is replaced, with no error (default 6: the server enforces it instead of documenting a trust rule).
- **Replay.** `replay` records through the same recorder under the same std config, so an honest session's fingerprint still reproduces. `to-test` names the file and writes the header from the session's fingerprint, unchanged.
- **Masked `data.at`.** Two errors whose `data.at` an `error:` entry masks share a fingerprint when their code, route and `data.at` length match. A session that holds less cannot be split by a value it does not hold.

### 3. Replay seeds every live store (lead 1)
`replay` seeds every live store. One that the base `state` lacks starts at its snapshot `initial`, the base its undo replays from: the declared initial unless the store was restored or folded. `dispose` then puts every store back, so no run reads another's leftovers, and two `minimize` runs are byte-equal whatever the live stores held.

## Alternatives
- **A write token for `sessions.ingest`.** Rejected: the recorder posts from browsers, so any token is public (PLAN D1).
- **Per-IP limits.** Rejected: the server has no trusted client address behind a proxy, and the k.server caller is the identity it already has.
- **Evict whole fingerprints by caller.** Rejected: a fingerprint can hold sessions from many callers, and dropping it evicts the smaller holders too.
- **Keep the posted fingerprint in a separate `claimed` field.** Rejected: that is a second fingerprint (default 2), and nothing reads it.
- **Re-encode the archive once per write.** Rejected: that is still linear in bytes per write. Tracked sizes make it linear in sessions.
- **Lead 1: refuse a session whose `state` lacks a rendered store.** Rejected: a store created after `record` started legitimately has no base value.

## Spec diff
std.sessions (1,495 -> 1,498 printed tokens):
- `SessionEvent` `error` carries `route`. "`fingerprint`: 12 hex of sha256(`code`, `data.at`, `route`: route id then) of the first `error` event as recorded (none: `''`, `''`, `route.id`)."
- `replay` renders the base "(missing stores: `initial`)".
- **Ingest** rewritten: it recomputes `error` and `fingerprint` from `events` and files the session with its `caller`. It states the three bounds and who loses a session at each. `sessions.list` returns the archive without callers.
- New clause: "One caller's flood never evicts another caller's session; a POST naming another's `fingerprint` is filed under its own, the other's count unchanged."
- Trims, wording only: the ingest clause is shortened. The E2001-E2004 clauses merge into "E2001-E2004 each fire on a fixture, not on its clean twin." The `ingest` file name reads `<fingerprint>-<n>.json`, which is what the command writes. `Session` type field annotations are dropped, the `sessions.Session` sentence is folded into Rules, and some prose is shortened.

## Conformance diff (rfc:0072)
- Added `packages/std-sessions/conformance/ingest-caller.test.ts`. It replays the backlog flood (one real POST, then 20 POSTs of 240 KiB with distinct codes from one caller) and asserts that the real session is listed. It also asserts that a POST naming another session's fingerprint, after a `nav`, is filed under its own fingerprint and leaves the other's count at 1.
- Edited `ingest-list.test.ts`: the clause header and an error event with `route`. Edited the headers of `E2001`-`E2004` to cite the merged clause.

## Migration
None. No sessions or archives have been released: the Session format stays `v: 1`, and `route` is required on `error` events. A development `.sessions.storage` written before this change fails the archive schema; delete it.

## Token impact
std.sessions prints 1,498 tokens, within the 1,500 section budget.

## Known limits
- The caller quota is per `keel-caller` cookie. A client that discards the cookie gets a new caller per write, so the quota bounds a cooperative or careless flood, not an adversary that rotates callers. This residual is recorded in `docs/THREAT-MODEL.md`.
- Anyone can post a session with a real bug's code, `data.at` and route. That raises the fingerprint's `count`, but the other callers' kept sessions stay.
