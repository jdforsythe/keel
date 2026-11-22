# ADR-0215: an open stream judges its user again before each delivery; a refused read is `denied` (RFC 0193)

**Status:** accepted (operator, 2026-11-22).

**Context.** k.user keeps an event stream's `user` fixed from open to close, so a member who signs out in another tab keeps hearing each change on the open stream. std.live shows `connecting` for a refused re-read and retries it forever, so `apps/household` wraps `read` to catch the 403 and compose its own status.

**Decision.** A live loader's args gain `currentUser()`: the identity source's `identify` run again on the request the stream opened with, `''` on a throw, an invalid answer or 5,000 ms; the stream's `user` where it came from a verified `x-keel-user` or the harness. std-channels calls it before each delivery (`saved`, `changed`, `message`), an answer under 1,000 ms old standing; an answer other than the stream's `user` gives `closed` `denied` in place of the event. std.live puts `status()` at `denied`, closes the stream and stops reading when a read's `err` is `api.status` 401 or 403 or a KeelError `keel.denied`; other failures stay `connecting`.

**Alternatives.** A session change signal (Keel holds no session; sign-outs on other devices or replicas pass through no `handle` it sees); a bounded interval (identify calls for idle streams, and a delivery inside the interval still goes out); a documented wrapper (every live page repeats it, the stream keeps reporting changes); switching the stream to the new user (a stream continues for someone never judged at open); `denied` for every failed read (a 502 should retry).

**Consequences.** k.user and k.server change by RFC under the provisional freeze. A delivery can cost one `identify` per stream per second. The household drops its 403 wrapper. A library whose sign-out only clears the browser cookie keeps its streams open until its token expires, as its own revocation model says.
