# ADR-0186: k.privacy: the written forms the server log scrub marks (RFC 0164)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** The server's scrub marks a value in a dozen written forms (JSON, URL and base64 encodings, case-folded), but k.privacy said only that a value becomes `[secret]` or `[pii]`, and the server README called every form but the plain one "no contract". k.privacy was at its 1,500-token limit.

**Decision.** k.privacy Sinks lists the forms, with base64's two rules: unpadded copies only from 8 bytes, and inside longer base64 only from a byte offset that is a multiple of 3, to its end or for a multiple of 3 bytes; letter case folds one unit at a time; a form under 3 units is marked only as a whole token. The `req` path segment rule moves to k.serverlog Path to make room; no Conformance bullet changes section.

**Alternatives.** Say in the README that the forms are not a contract (an untestable guarantee); a new section (a map row for text k.serverlog can hold); raising the limit (not allowed).

**Consequences.** Dropping a form from the scrub now fails conformance. The README's "no contract" sentence goes in the build. Two server conformance headers are retagged to k.serverlog.
