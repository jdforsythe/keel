# RFC 0072: sessions ingest size accounting, and a fingerprint recomputable from the session

Status: accepted (ADR-0061, 2026-11-09). It applies three WORKFLOW RFC defaults: 4 (privacy by default), 6 (kernel-level enforcement over documentation) and 2 (one way per thing). The orchestrator accepts it because it adds no hand-written user-facing API shape, weakens neither privacy nor auth, and needs no golden-app migration.

## Problem
Backlog 0225, 0226, 0234-0236 and lead 1 of task 0225:
1. **0225, ingest cost.** `addSession` re-encoded the whole 4 MiB archive once per eviction step and again in the invariant. Anonymous ingest is one bounded buffer: 20 POSTs of about 240 KiB with distinct error codes replace every real session.
2. **0226, fingerprint spoofing.** The fingerprint hashed two values the session did not always hold: `data.at` before redaction, and the route the error fired under. When a `nav` preceded the error or an `error:` entry masked `data.at`, `ingestFingerprint` kept the posted 12-hex value. A client could therefore file a session under another bug's fingerprint.
3. **0234, replay without the recording's redaction.** `replay` recorded under a ctx with no std binding. A session recorded with an `error:<code>#data.at` entry therefore never reproduced.
4. **0235, typed values in the fingerprint.** `redactionOf.error` scrubbed every masked typed value out of `data.at`, so one bug got a fingerprint per value typed. The blanked text, set beside the public element id, also revealed the typed value.
5. **0236, the ingest bound.** The 256 KiB limit was checked on the posted body. The ingest then rebuilt `error` from the first error event, so a stored session could be twice the bound.
6. **Lead 1, replay with a store missing from `state`.** `replay` seeded only the stores the base `state` names. Other stores kept what an earlier run left, so `minimize` was not deterministic.

## Proposal
### 1. Size accounting (0225, 0236)
- **Archive entry.** Each kept session is stored as `{ bytes, session }`. `bytes` is the session's encoded JSON length, measured once when the session is filed. Per fingerprint, the archive keeps `count`, `first`, `last` and the newest 5 sessions in arrival order, as before.
- **Eviction.** Past 64 fingerprints or 4 MiB, the fingerprint with the oldest `last` goes; ties go to the smaller key. The fingerprint this write filed never goes. The archive size is an upper bound, summed from each kept session's `bytes` plus fixed per-entry and per-session overheads. A write is therefore linear in the number of sessions and never re-encodes the archive. The invariant `sessions.capped` checks the same bound, and a property test shows that the bound covers the real JSON.
- **Bound as filed.** The 256 KiB limit (413) applies to the session as it will be stored, after `error` and `fingerprint` are rebuilt.
- **Listing.** `sessions.list` returns `Listing`: per fingerprint `count`, `first`, `last` and the sessions, without byte counts.
- **No per-caller defence.** Anonymous ingest stays one bounded buffer. A flood of 4 MiB of distinct fingerprints replaces its contents, and the defence is the operator's rate limiting in front of the service (THREAT-MODEL).

### 2. A fingerprint recomputable from the session (0226, 0234, 0235)
- **Error event.** The `error` `SessionEvent` gains `route: string`, the id of the route current when the error fired: the latest `nav`'s route, else the base route. The field is required, and E2002 stays strict.
- **Hash.** The fingerprint is 12 hex of sha256 over three values of the first `error` event: its `code`, its `data.at` as recorded (after redaction) and its `route`. With no error event the hash uses `''`, `''` and the base route id. One internal function computes it from a session; the recorder, `replay`, `minimize` and `sessions.ingest` all call it (default 2).
- **Ingest.** `sessions.ingest` recomputes `fingerprint` and `error` (the first error event's error) from `events` and never reads the posted values. A posted value that differs is replaced, with no error (default 6).
- **Replay redacts as the recording did.** `replay` and `minimize` take `redact?: string[]`, the entries the recording ctx had. They bind those entries on the replay ctx, so the replay recorder masks what the live one masked. `keel session replay|minimize|to-test` passes the serving modules' `redact` literals from their `module.ts` (the same reader as `expose`).
- **`data.at` is not scrubbed.** Error messages and `data` still drop every value a `redact` entry matched, but `data.at` is exempt. It names where the error fired and feeds the fingerprint, and only an `error:` entry masks it.
- `to-test` names its file and writes its header from the session's fingerprint, unchanged.

### 3. Replay seeds every live store (lead 1)
A store the base `state` lacks starts at its snapshot `initial`, the base its undo replays from. `dispose` puts every store back, so two `minimize` runs are byte-equal whatever the live stores held.

## Alternatives
- **Per-caller eviction and quota** (largest share loses first; at most 1 MiB in 16 fingerprints per caller). Rejected, because the caller is worthless as a quota key on this service. A cookieless POST mints a fresh caller and ingest is the only write, so a flood rotates callers for free. Ranking by share then made the flood cheaper: 64 tiny cookieless POSTs evicted the real sessions, which hold the most bytes. Per-caller slots within a fingerprint fail the same way.
- **A write token.** Rejected: the recorder posts from browsers, so any token is public.
- **Keep the posted fingerprint in a separate `claimed` field.** Rejected: a second fingerprint (default 2), which nothing reads.
- **Carry the `redact` entries in the session.** Rejected: a client would choose the redaction its replay applies, and the session format would grow.
- **Read `.keel/std.json` in the job.** Rejected: it exists only after `keel build`. `module.ts` literals are what `expose` already uses.
- **Lead 1: refuse a session whose `state` lacks a rendered store.** Rejected: a store created after `record` started legitimately has no base value.

## Spec diff
std.sessions (1,495 -> 1,491 printed tokens):
- `SessionEvent` `error` carries `route`. "`fingerprint`: 12 hex of sha256(`code`, `data.at`, `route`: route id then) of the first `error` event as recorded (none: `''`, `''`, `route.id`)."
- "error messages and `data` (but `data.at`) drop every redacted value."
- `replay(session, { routes, redact? })` renders the base "(missing stores: `initial`)" and is "bound to the recording's `redact` entries". `minimize` takes `redact?`. The commands run "with its modules' `redact`".
- **Ingest**: "as filed over 256 KiB 413", "recomputes `error` and `fingerprint` from `events`", "at most 64 fingerprints and 4 MiB, oldest `last` evicted, never the one written".
- New clause: "A POST naming another session's `fingerprint` is filed under its own recomputed one; 20 flood POSTs totalling less than 4 MiB leave an earlier real session in place."
- Trims, wording only: the ingest clause is shortened. E2001-E2004 merge into one clause. The `ingest` file name reads `<fingerprint>-<n>.json`, which is what the command writes. The `Session` type annotations are dropped, and some prose is shortened.

## Conformance diff (rfc:0072)
- Added `packages/std-sessions/conformance/ingest-recomputed.test.ts`. A POST naming another session's fingerprint, after a `nav`, is filed under its own, and the other's count stays 1 (100 runs). One real POST, then 20 cookieless POSTs of 100-190 KB with distinct codes, leaves the real session listed.
- Edited `ingest-list.test.ts` (the clause header, `route` on the error event) and the `E2001`-`E2004` headers, which now cite the merged clause.

## Migration
None. No sessions or archives have been released, so the Session format stays `v: 1` with `route` required on `error` events. A development `.sessions.storage` written before this change fails the archive schema; delete it.

## Token impact
std.sessions prints 1,491 tokens, within the 1,500 section budget.

## Known limits
- Anonymous ingest is one bounded buffer. 4 MiB of distinct fingerprints, or 64 small sessions with distinct routes, replaces its contents. Five posts with a real bug's code, `data.at` and route push out that fingerprint's kept sessions and raise its `count`. The defence is the operator's rate limiting in front of the service.
- A replay given other `redact` entries than the recording had does not reproduce a masked `data.at`.
