# ADR-0239: k.compat: `sources` hashes each file's normal form (RFC 0217)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** `.keel/surface.json` records each file the surface run evaluated with the hash of its text, so a formatter's import sort, re-indent or quote change in any of them made `keel check` report E1005 and skip `--base` comparisons until `keel build`, which then rewrote the file with new hashes and nothing else. E1005 there protects `--base` verdicts (E1562, E1563, W1564) and agents' reads from a surface that no longer matches its code; `keel check` never evaluates app code, so it cannot recompute the surface.

**Decision.**
- Each `sources` value is `hashOf` of the file's normal form: a JSON value built from its syntax tree, parsed as the compiler parses it, by one walker in `@keel/compiler/internal` that `keel build` and `keel check` share. Shape and `version: 2` unchanged.
- Dropped: comments, whitespace, line endings, a byte order mark, parentheses, semicolons, trailing commas, member separators, quote style and escapes (cooked values), number spelling, regular expression flag order, key quoting, JSX text spelling (the JSX whitespace rule, `{"x"}` as text), import declaration order, place, specifier order and split.
- Kept: each import binding as a set member (source, attributes, type or value, imported and local name); side-effect imports in their order among themselves; everything else in source order, object property order and types among them.
- Keel's own encoding of node types and fields, not the parser's output; a change to it is E1005 until `keel build`, as for any artifact. No TypeScript compiler takes part. A missing or unparsable listed file counts as changed.

**Alternatives.**
- Hashing the evaluated surface: `keel check` cannot evaluate to recompute it.
- Dropping `sources`: a stale surface would check clean and `--base` would judge a surface the code no longer has.
- A token stream: parentheses, semicolons and commas are tokens a formatter changes, and dropping `;` merges distinct programs.
- Hashing only contracts and server files: schemas live in other evaluated files.

**Consequences.** A formatter pass leaves `keel check` clean and `surface.json` byte for byte the same. A type-only edit still costs one `keel build`. A reorder of binding imports around a side-effect import is not seen. Every `surface.json` in the tree is regenerated. k.compat reads `implemented` until its four new clauses are covered.
