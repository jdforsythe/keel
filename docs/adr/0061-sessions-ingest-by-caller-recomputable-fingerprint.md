# ADR-0061: sessions ingest by caller, a fingerprint recomputable from the session (RFC 0072)

**Status:** accepted (2026-11-09). This amends ADR-0059 (RFC 0070) on the fingerprint and the ingest archive.

**Context.** The red-team pass on 0093 found two problems with `sessions.ingest`, which takes anonymous posts:
- One caller's flood evicted every other caller's sessions, and each write re-encoded the 4 MiB archive once per eviction step (0225).
- A client could file a session under another bug's fingerprint, because the fingerprint hashed values the session did not hold and the server then kept the posted value (0226).

Lead 1 found that `replay` left stores the base `state` lacks at whatever an earlier run held, so `minimize` was not deterministic.

**Decision.**
- **Filed by caller.** Each archived session is `{ caller, bytes, session }`.
  - Past 5 in a fingerprint, the caller holding the most there loses its oldest session.
  - One caller holds at most 1 MiB in 16 fingerprints; past that, its own oldest sessions go.
  - Past 64 fingerprints or 4 MiB, the caller with the largest share (bytes, then fewest sessions, then key) loses its oldest session. A caller other than the writer never loses one in the fingerprint this write filed into, and the new session never goes.
  - Sizes come from the tracked `bytes`. `sessions.list` returns the sessions without callers or bytes.
- **Fingerprint from the session.** The `error` event carries `route`. The fingerprint hashes the first error event's code, recorded `data.at` (after redaction) and route. The recorder, `replay`, `minimize` and `sessions.ingest` compute it with one function. Ingest recomputes `fingerprint` and `error` and never reads the posted values.
- **Replay seeds every store.** A store the base `state` lacks starts at its snapshot `initial`.
- **No write token.** The recorder posts from browsers, so any token would be public.

**Alternatives.**
- A write token.
- Per-IP limits.
- Evicting whole fingerprints by caller.
- A separate `claimed` fingerprint field.
- Re-encoding the archive once per write.
- Refusing a session whose `state` lacks a rendered store.

**Consequences.**
- `route` is required on `error` events. The Session format stays `v: 1`, since none has been released.
- Errors whose `data.at` is masked share a fingerprint when their code, route and masked length match.
- A client that discards its caller cookie gets a fresh quota per write. This residual is in `docs/THREAT-MODEL.md`.
- Anyone can raise a real fingerprint's `count` by posting the same code, `data.at` and route. Other callers' kept sessions stay.
