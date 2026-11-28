# ADR-0235: std.sessions: `capture` with no recorder is E1056; the session-id rule is spec, groups included (RFC 0213)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** std.sessions said only that `capture [url]` saves `sessions.live`. A page with no `record` reports `null`; the code answered that with E1056, a page without std-sessions the same way, and an `error` section with `ok` and nothing written. The session-id rule `^[A-Za-z0-9_-]{1,64}$` lived in a `parse` override on `sessions.Session`, so schemas nesting it (`SessionGroup.users`, the ingest `Archive`) skipped it, and no spec text stated it. No session id becomes a file path, URL or storage key today: files are named by fingerprint and a counter, group users by index; the id reaches output records and issue bodies.

**Decision.**
- `capture` writes a file only for a section holding a `Session`; a section that is absent, `null`, an `error`, or not a `Session` is E1056, exit 1, nothing written, the message naming the case. `ingest` failures are E1056 too; an empty archive stays `ok`.
- `id` matches `^[A-Za-z0-9_-]{1,64}$` wherever a `Session` parses, nested ones included. A bad id answers its container's schema failure: E2002 (session file), 422 `keel.fields` (`sessions.ingest`), E2007 (group file, `replayGroup`).
- A group has no id of its own and names its users by index; no recording has a name. No other id needs the rule.

**Alternatives.**
- `ok` with nothing written: hides a forgotten `record` from CI and agents.
- A new E2011 for "no recorder", or E1057 for an `error` section: a second code where E1056 and a message that names the case serve.
- A new code for a bad id, or patching each container's `parse`: two ways, and every new container would need the patch.

**Consequences.** The rule moves into the schema, so every container inherits it. A CI step that captures from a page without `record` now fails. Nothing stored under `apps/*` or `examples/*` is refused. std.sessions and std.multi read `implemented` until their three new clauses are covered.
