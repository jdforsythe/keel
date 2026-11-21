# ADR-0152: every server log record is bounded, escaped and cut after the scrub (RFC 0130)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** A `diag` record held a thrown text whole, so an echoed 1 MiB body or a runner's long rejection wrote one line of that size, and the scrub walked all of it. The compact `diag` wrote a message's line breaks and terminal escapes raw, so a thrown text could add a line that reads as a `req` record. A cut placed before the scrub would keep the head of a secret that straddles it.

**Decision.**
- D1: k.serverlog owns how a record is written. Each variable part (a `diag` message and frames, a `req` method and path) is scrubbed, escaped, then cut.
- D2: with a secret or `.pii()` value held, a text over 2,000,000 characters is not read and is one mark, as past the scrub cap; with none, it is not scrubbed and only its head is read.
- D3: control characters (U+0000 to U+001F, U+007F to U+009F), U+2028, U+2029 and `…` are written as `\u` and four hex digits, in compact and json.
- D4: a message or path keeps the longest head whose escaped form is at most 2,048 characters, a frame or method 256, then `…+<n>`, `n` the scrubbed characters left out. `…` in a record is always a cut.
- D5: a `diag` holds at most 5 frames. A record is then at most 8,192 characters and 12,288 bytes of UTF-8 beyond a `req` route id, for every record kind, the last resort's `diag` and stderr line included.

**Alternatives.**
- Cut before the scrub: keeps a straddling value's head.
- A json `cut` key: compact still needs the escape, and a reader of `message` misses it.
- A run-time check on the whole line: the part bounds already guarantee it.
- Byte bounds per part: needs an encoder per part for the same guarantee.

**Consequences.**
- A compact record is always one line, and a terminal tailing the log gets no escape sequence from app text.
- A json message holding a line break carries `\u000a` as six characters.
- The scrub's worst case per text is 2,000,000 characters (about 20 ms, estimated from the scrub-cost measurements).
- `@keel/server` grows about 190 to 250 bytes against 211 left; a raise to 24.25kb is the owner's call.
