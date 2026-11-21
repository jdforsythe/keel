# k.formats: Format types
status: conformance-covered

A format type narrows a schema (k.schema) by a predicate. The stdlib's dates, text and messages are format types; app code declares none (E1106, k.schema).

**Format types.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false) and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; false fails with rule `format` at that path. `encode` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `decodeStrings` coerces as `base` does, then parses, so a value `check` refuses is a `format` issue; `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name. `sampleFormat(node, sample)` (`@keel/testing/sample`, no fast-check) maps `sample(from)` through `map` once: the encoded value when `check` accepts it, else undefined, also for a node that is no in-memory format.

**Conformance.**
- For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106.
