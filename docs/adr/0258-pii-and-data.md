# ADR-0258: undeclared keys unrecorded, plain values only, a process-wide anonymous stream count (RFC 0236)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** A session recorded store state without its schema, so an open object's undeclared keys, personal data among them, stayed in the recording. A `Secret` in a `Map`, a `Set`, a symbol key or a non-enumerable key under an undeclared key parsed, and every JSON walk (`encode`, `piiValues`, the server log's value set, `redact`, `#k-state`) missed it. Cookieless channel streams were counted per module, so many modules let anonymous clients fill the app's stream pool. The threat model named `keys` in `#k-state` without saying what a key there can do.

**Decision.**
- std.sessions records store state, `tx` payloads and route values as their schema encodes them (unencodable: `null`); an undeclared key is not recorded; declaring the key is how to record it. A marked open object's undeclared values are dropped from later error text. A recording is redacted once, in the browser; the server's log scrub covers log records, not a filed session.
- k.schema defines plain data. `json` accepts exactly it; under an undeclared key a value that is not plain fails rule `type` at its path; `object`, `record` and `union` nodes need a plain object and `array` a plain array. So a parsed value is plain data but for its `Secret`s, and own enumerable string keys reach all of it. A Proxy and a mutation after `parse` are stated limits.
- std-channels counts cookieless streams over every module's channel routes in the process against the opening route's module's `perAnonymous`; `perCaller` and `maxStreams` stay per module. New section std.channels-limits.
- The threat model says what a write key in `#k-state` can do: suppress a server write only where that store already holds the same transaction and key. `openHub` shares `restore`'s key fallback through `@keel/store/internal`.

**Alternatives.**
- A redaction mark for undeclared keys: keeps the key, which can be personal data.
- Refusing non-plain values only under undeclared keys: a `Map` at `s.object({})` hides the same way.
- A new anonymous config key, or counting by address: two knobs for one population; Keel sees no trustworthy address.

**Consequences.** A class instance at an object or array position no longer parses. A replay whose run depends on an undeclared key may not reproduce (E2004). Cookieless visitors share one pool of at most the largest `perAnonymous`; a client minting caller cookies stays bounded only by `maxStreams`, a stated limit. k.schema, std.sessions, std.channels and std.channels-limits read `implemented` until their new clauses are covered.
