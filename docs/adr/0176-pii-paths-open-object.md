# ADR-0176: k.schema: `piiPaths` lists a marked open object's undeclared keys as `*` (RFC 0154)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** `piiValues` treats the undeclared keys of a marked open object as personal data, but `piiPaths` listed declared leaves only, so path-driven sinks (session redaction, the evidence report) had no entry for them.

**Decision.** `piiPaths` adds `<object path>.*`, with the mark's class, after the declared leaves of every open object under a mark. A lookup of one path reads it through declared fields: a declared path, leaf or not, takes its nearest mark's class, and `<object>.*` covers only keys the object does not declare, at any depth under them; an undeclared key of a closed object also takes the class in force (it only over-masks). Through a union the lookup never gives less than `piiPaths`: of the variants' matches with a class, the one with the fewest `*` wins, the first in declaration order on a tie, as `piiPaths` lists it.

**Alternatives.**
- State the gap as a limit: sinks stay blind to data `piiValues` calls personal.
- A second wildcard for undeclared keys: one more syntax for the same meaning.
- Close marked objects: a mark would change parsing.

**Consequences.** `piiPaths` and `piiValues` cover the same data; `pii.json` shows where an object takes personal data beyond its fields; `@keel/forms` reads a bound field's class along the declared path, so a declared object keeps its own mark; std.sessions must redact undeclared keys a path matches (follow-up).
