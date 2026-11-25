# ADR-0259: a library declares format types; E1106 holds for app code (RFC 0237)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** E1106 keeps `s.format` out of app code. A library's files are read as the app's for every rule (RFC 0163), so std-text, std-temporal, std-messages and std-tokens, once on the library format, would report E1106 on the format types they exist to declare.

**Decision.**
- E1106 does not report `s.format` in a library's files: those under `src/` and `unsafe/` of a package folder with `"keel": "library"` and a scoped name, installed, linked or read in its own folder.
- Every other rule reads those files as the app's. Any other file of a folder marked library, one under `modules/` among them, keeps E1106.
- Test code stays outside E1106, an app's and a library's alike.
- An app's own workspace library may declare format types: it is a library like any other.

**Alternatives.**
- An `unsafe(` lift per format: counts a library's purpose as escapes, and would let an app lift E1106 too.
- Format types in `@keel/schema`: moves stdlib predicates into the kernel, and a third-party library still could not declare one.
- E1106 on linked libraries: refuses the stdlib's formats in every workspace app.

**Consequences.** k.formats gains Who declares and two Conformance clauses and reads `implemented` until they are covered. k.parity's By kind holds for format types. The stdlib's formats lane proceeds on it.
