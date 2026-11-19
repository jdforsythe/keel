# ADR-0068: format types in k.schema (RFC 0079)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 1 and 6.

**Context.** Stdlib values need validation a k.schema primitive cannot express: a calendar date that exists, a UTC instant, a time zone the runtime knows, a line of at most 80 graphemes with no bidi override, a message template whose placeholders are its declared params. Every derivation (parse, encode, generators, docs, JSON Schema) must still come from the schema (principle 4). A pluggable primitive kind would need a hook in every derivation.

**Decision.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure predicate and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; a refusal is the new rule `format` at that path. `encode`, `decodeStrings` and JSON Schema are `base`'s, with JSON Schema adding `format: name`; `doc()` is the name; `gen` maps the generator of the schema `from` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` are held beside it in memory, so nodes stay JSON. E1106 reports `s.format` in app code: format types are the stdlib's. The same RFC adds `s.enum(values, { pathDefault })`, which parse, encode and gen ignore (ADR-0070).

**Alternatives.**
- A pluggable primitive kind, rejected: every derivation would need a hook, and the node set would stop being closed.
- `s.string({ pattern })`, rejected: a regular expression cannot check a real calendar day or count graphemes, and an author-supplied pattern is a ReDoS risk at `parse`.
- A generator given fast-check (`gen(fc)`), rejected: it puts fast-check types in every stdlib package; mapping a schema's generator keeps every generator derived from a schema.
- Format types written in app code, rejected: each app predicate would bring a generator no one tests, and the property tests built on it would trust it.

**Consequences.**
- Every exhaustive walker over schema nodes handles `format` (schema, forms, router, cli, std-sessions); TypeScript finds each one.
- `Rule` gains `format`; forms and router messages gain its case.
- A serialized node keeps the name and loses the predicate.
- k.schema grows from 1,239 to 1,474 tokens; `@keel/schema` by about 0.35 kB gzip, within its 5 kB budget.
