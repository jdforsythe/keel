# ADR-0138: a std.text value shows a character and holds no bidi control (RFC 0116)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** `line` and `para` required only a character outside `White_Space` and forbade the bidi embeddings, overrides and isolates. They accepted values that show nothing (`'\u200B'`, `'\u3164'`, `'\uFEFF'`, a lone tag character) and the bidi marks U+200E, U+200F and U+061C.

**Decision.**
- D1: a non-empty value holds a visible character: one outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cf` and `M`, and U+2800, tested on the whole value; ZWJ sequences, variation selectors and flags stay valid. U+3164 is `Default_Ignorable_Code_Point`; U+FFF9 to U+FFFB are `Cf`; a value of marks alone has no visible character.
- D2: the whole `Bidi_Control` set is forbidden (U+061C, U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069).
- D3: the sets are the engine's `\p{…}` property escapes, plus U+2800.
- D4: a value holding a lone surrogate (`Cs`) is refused with rule `format`.

**Alternatives.**
- Forbidding every default-ignorable character: breaks emoji sequences.
- Forbidding tag characters outside emoji tag sequences: left out; a hidden run after a visible character stays valid.
- A hand-kept list: drifts from Unicode.
- Refusing private use (`Co`) and unassigned (`Cn`) code points: private use characters have glyphs in some fonts, and `Cn` moves with the engine's Unicode version.

**Consequences.**
- A title or name is never blank on screen and never reordered by a hidden mark.
- Stored values with a bidi mark, a lone surrogate or nothing visible (U+2800, combining marks alone) fail `parse` with rule `format`.
