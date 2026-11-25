# ADR-0252: the log scrub reads decoded views under a byte cap; one event has a size cap (RFC 0230)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** The server's log scrub matched nine exact encoder outputs of each value. Copies made by other URL encoders slipped, as did hex, HTML-safe JSON, `\/`, entities, NFD, JSON in a URL and unaligned base64. Its cap counted characters of those outputs, so non-ASCII values reached it about 2.2 times sooner than stated. A 790 KB body of secrets cost about 1.2 s of event loop. A `req` path mark left slashes beside it. A 422 re-render dropped plain siblings of a secret. No event stream capped the size of one event, on either side.

**Decision.**
- Each text is read three ways: as is, as its decoded view, and as the view of that view. One decoder undoes `%` escapes (as UTF-8), `+`, JSON escapes, five named entities and numeric entities. A copy in a view marks the raw text it came from.
- A value's forms: as given, NFC, NFD, and from 8 bytes hex and base64 at all three byte alignments, the mark widened to every character that carries a bit of the value. Under 8 bytes, the padded base64 encoding standing alone. Everything else is a stated limit in k.privacy and the threat model.
- The cap is 65,536 bytes of the scope's distinct values as UTF-8, secret and `.pii()` together. It replaces the forms-character and value-count caps. The matcher builds in steps linear in those bytes and reads each text in steps linear in its length.
- A lost `onSecret` slot makes each text one mark after the server's prefix, as past the cap. Overlapping copies are `[secret]` when any is a secret's.
- A `req` path mark or cut takes in the slashes beside it.
- A server event over 1,048,576 bytes as written ends the stream with `keel.unexpected` and a `diag`. A service client caps one line block at `maxBytes` and ends with `api.decode` (`rule: 'max'`), reading in linear time.
- 0442 is a bug: a key is secret only when some schema path can reach an `s.secret`.

**Alternatives.**
- Listing more encoders.
- Decoding to a fixed point.
- An NFC view of the text.
- A forms-character cap.
- A 256 KiB cap.
- A `maxEventBytes` option.
- Skipping an oversized event and keeping the stream open.

**Consequences.** More copies are found, and fewer are built per value. The cap means what it says for any script, and a request's scrub cost is bounded. Past 64 KiB of values a request's log over-marks: a large `.pii()` list page logs its path as `[pii]`. A live loader cannot send an event over 1 MiB. k.privacy, k.serverlog, k.server, k.services and k.forms read `implemented` until their new clauses are covered. The threat model and READMEs change with the build.
