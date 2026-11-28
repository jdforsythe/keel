# ADR-0061: sessions ingest size accounting, a fingerprint recomputable from the session (RFC 0072)

**Status:** accepted (2026-11-09). This amends ADR-0059 (RFC 0070) on the fingerprint, replay and the ingest archive.

**Context.** The red-team pass on 0093 and its follow-ups found these problems:
- The ingest archive re-encoded 4 MiB once per eviction step (0225).
- A client could file a session under another bug's fingerprint (0226).
- Replay ignored the recording's `redact` entries (0234).
- Typed values changed `data.at` and so the fingerprint (0235).
- A stored session could exceed the 256 KiB bound (0236).
- `minimize` depended on what live stores held (lead 1).

**Decision.**
- **Size accounting.** Each archived session is `{ bytes, session }`. Eviction stays the fingerprint with the oldest `last` (ties: smaller key), never the one written, with the newest 5 per fingerprint. Sizes come from the tracked `bytes`, so a write is linear in sessions. The 256 KiB bound applies to the session as filed.
- **Fingerprint from the session.** The `error` event carries `route`. The fingerprint hashes the first error event's code, its recorded `data.at` and its route, computed by one function everywhere. Ingest recomputes `fingerprint` and `error` and never reads posted values.
- **Replay redaction.** `replay` and `minimize` take `redact` and bind it on the replay ctx. `keel session` passes the serving modules' `redact` literals.
- **`data.at`.** It is never scrubbed of typed values; only an `error:` entry masks it.
- **Replay seeds every store.** A store the base `state` lacks starts at its snapshot `initial`.
- **Anonymous ingest is one bounded buffer.** The defence against floods is the operator's rate limiting.

**Alternatives.**
- Per-caller eviction and quota, rejected: a cookieless POST mints a fresh caller, so rotation is free and ranking by share made the flood cheaper.
- A write token.
- A separate `claimed` fingerprint field.
- `redact` entries carried in the session.
- Reading `.keel/std.json` in the job.
- Refusing sessions that lack a store.

**Consequences.**
- `route` is required on `error` events. The format stays `v: 1`.
- Errors whose `data.at` is masked share a fingerprint when their code, route and masked length match.
- A flood of 4 MiB of distinct fingerprints, or five posts matching a real fingerprint, replaces kept sessions. `docs/THREAT-MODEL.md` records this and points to rate limiting in front of the service.
