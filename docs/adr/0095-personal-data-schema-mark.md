# ADR-0095: personal data is a schema mark from a closed class set, redacted in every sink (RFC 0083)

**Status:** accepted (2026-11-10), user decisions D1 and D2, under the WORKFLOW RFC defaults 4 and 6.

**Context.** Only `s.secret` and std.sessions' per-module `redact` paths existed. Nothing marked a field as personal across sinks: an uncaught throw's message reached the `diag` log verbatim, a session kept input values but passwords and `el:` entries, and a route param could carry an email into history and proxy logs.

**Decision.** A new kernel section, k.privacy, takes k.schema's Secrets paragraph, E1105 and its clause verbatim, and adds `.pii(class)` over the closed `PiiClass` (`name`, `contact`, `location`, `identifier`, `financial`, `special`, `network`, `content`). The mark changes no type or derivation; `piiPaths` and `piiValues` read it. Sinks: std.sessions redacts marked values to generated ones at capture, beside its `redact` entries, whose `tx:`, `store:` and `route:` subjects stay (D2); a control bound to a marked field carries `data-k-pii` and the ctx observer masks its input values; a `diag` message drops the request's marked values; the evidence bundle holds no app value. E1111 refuses a marked node in a route's `params` or `search`.

**Alternatives.**
- A wrapper type like `Secret<T>`, rejected: personal data must flow through app code, and every read would need an unwrap.
- Free-form labels, rejected: an auditor's inventory needs a fixed set (principle 4).
- Replacing the `tx:`, `store:` and `route:` `redact` subjects with the mark, rejected by the user (D2): projects keep their session config, and either a mark or an entry redacts a value.

**Consequences.**
- Redaction coverage is computed per (path, sink) from each sink clause's ledger rung; golden-3's canary test is the independent check.
- A marked value copied into an unmarked field, or derived from one, is not redacted.
- k.schema goes from 1,498 to 1,272 tokens; its clauses 10 to 12 renumber to 9 to 11.
