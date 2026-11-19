# ADR-0174: k.schema: one blank set for `required`, and a portable JSON Schema pattern (RFC 0152)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** `required` read a string as blank only when JavaScript's `\s` covered it, so zero-width, filler, format and combining-mark-only values passed; the JSON Schema `pattern: "\\S"` is read differently by Python `re` and JavaScript.

**Decision.** Blank is no character outside `White_Space`, `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Cs`, `M` and U+2800, the set k.a11y already reads for a label. JSON Schema adds a negated class of `\u` ranges for that set's BMP part without `M` and `Cs`, which ECMA-262 and Python read alike; `parse` stays the rule.

**Alternatives.**
- Keep `\S`: required fields stay blank on screen, consumers disagree.
- `\p{…}` in the pattern: Python `re` cannot read it.
- std.text's narrower set: a second blank set beside k.a11y's.

**Consequences.** A form, a store and a label refuse the same blank values; Python and JavaScript validators of MCP and OpenAPI schemas agree with each other, and never accept a value `parse` would only refuse for marks, surrogates or astral blanks.
