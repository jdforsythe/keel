# ADR-0130: scrub bounds, sinks and reach (RFC 0107)

**Status:** accepted (user for the decisions, orchestrator for the choices, 2026-11-17).

**Context.** The server's log scrub (k.privacy Server log) had five gaps. A request's secret set had no size bound: values whose folded forms repeat grew it without reaching the 2,000,000-character cap. Past that cap a document request's record read `[secret]` while a live loader's read `loader <id> threw: [secret]`. A secret route param was written raw in the `req` line's path, and E1111 did not report it. A runner's secrets joined no set and its `failed` record was not scrubbed. Keys inside a secret (`s.secret(s.record(...))`, `s.secret(s.json())`) were left in clear, because the value alone cannot tell a record key from a declared field name.

**Decision.**
- D1: a secret set holds at most 100,000 distinct values; past that, or past 2,000,000 characters of forms, the scope is past its cap for good (`pastCap`, read by `automatonOf`).
- D2: past a cap a `diag` record keeps the server's own prefix (`Diag.lead`: `loader <id> threw: `, `runner rejected, rerun in 1000 ms: `) and the rest of its message is one mark; each frame and the `req` path are one mark. One function, `scrubbedDiag`, writes every record.
- D3: E1111 covers `s.secret` in a route's `params` or `search`, as an error with no fix diff; the `req` path is scrubbed with the request's own sets after the handler settles.
- D4: `keepRunning` enters a fresh scope around each runner `run` and scrubs its `failed` record with it; a secret made at startup is a stated limit.
- D5: `Secret` keeps the node it was sealed under, and `secretValues` walks it beside the value, giving data keys and never a declared field name.

**Alternatives.**
- A window of recent values, or a mark per event: a secret made early and thrown late would be written in clear.
- Scrubbing the whole message past the cap: the record would name nothing, and the prefix holds no request data.
- Only the check, or only the run-time scrub, for URLs: one misses browser history and proxies, the other package route tables and unchecked builds.
- A scope per job or workflow step: those live in stdlib packages; one scope per `run` covers them from the kernel.
- Marking every key in a secret: a declared field name is schema text, and a conformance case keeps it.

**Consequences.**
- Log lines past a cap name the loader, action, guard or runner; dev bodies past a cap show `[secret]`.
- A long-lived runner's set can reach the count cap, after which its `failed` record is its prefix and one mark until it restarts.
- A secret param fails `keel check`; reset and invite links carry the token after `#` and the page posts it.
- `req` paths show `[secret]` and `[pii]` where a request's own values stand in them.
- `Secret.of` takes its node; `seal` and `gen` are its only callers.
- Limits that stay: secrets made at startup, a path the server forwards to a peer, a secret made in an in-process request a runner calls.
