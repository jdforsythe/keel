# ADR-0148: a revealed value is frozen deep, and the `req` path marks `.pii()` params and cuts at an encoded separator (RFC 0126)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** The server walks each `Secret` once per request scope, and `Secret.of` froze the `Secret` but not its value, so a value changed in place after its first reveal escaped the scrub. The `req` path marks covered secret params only: a `.pii()` param was logged as sent, and so was a secret behind an encoded separator (`/reset%2F<v>`), since that segment decodes to text no static segment equals. A route led by a param with a later secret marks every path whole, which the spec did not say.

**Decision.**
- D1: `Secret.of` freezes its value deep, after the value passes its schema check; a value that fails to parse is left unfrozen. Where the inner schema keeps the caller's object (`s.json()`), that object is frozen in place.
- D2: a segment at a `.pii()` `params` field of any route is `[pii]` as sent, by the secret line-up and cut; a longer path is cut there and the rest joins `[pii]`. `[secret]` wins at a shared segment; the earliest cut wins and its tail takes the cut segment's mark.
- D3: in a table with a secret param, the path is cut as `[secret]` at its first segment whose raw text holds `%2F` or `%5C` in either case. The check reads the raw segment apart from the line-up; statics are still compared after one decode.
- D4: `/:t` and `/:p/:t` (`t` secret) mark any path whole, stated in the spec and asserted in conformance.
- D5: five k.privacy prose items move to k.topology, k.reveal, k.api and k.cli or are dropped as duplicates, to keep the section at 1,499 tokens; no Conformance bullet moves.

**Alternatives.**
- Walk a secret again on every reveal: misses a change after the last reveal and costs a walk per reveal.
- Mark only a matched route's decoded params as pii: a 404 or a failed parse stays raw.
- Mark pii params without the cut: a pii value holding a raw `/` leaves its tail.
- Line up on decoded segments split at `/` and `\`: a second line-up rule and more bytes.
- Mark a led route as `/en/[secret]`: leaks the tail of a raw-slash token sent without its prefix.

**Consequences.**
- App code writing into a revealed object, or into an object it passed to `s.secret(s.json())`, throws a `TypeError`.
- A path longer than a lined-up pii route loses its tail in the log; the route id still names the page.
- A table with a secret param over-marks an app path holding an encoded slash; a pii-only table does not cut at one.
- `@keel/schema` grows 40 bytes. `@keel/server`'s budget is 24kb, raised under the owner's standing leave: the entry measures 24,365 B, and the pii marks and the separator cut cost 98 B of it.
