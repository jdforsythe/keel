# ADR-0151: a `label` of invisible characters is blank for E1802 (RFC 0129)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** E1802 called a literal `label` blank only for `""` or white space, so U+200B, U+2800 and U+3164 labels passed `keel check` and gave controls names a reader cannot see. std.text already defines a visible character.

**Decision.**
- D1: a literal `label` with no character outside `White_Space`, `Default_Ignorable_Code_Point`, `Cf`, `M` and U+2800 is blank for E1802, the std.text definition.
- D2: a JSX attribute string is tested with its character references decoded.
- D3: k.a11y names the rule by reference to std.text `line`, and pays for it with prose trims in the same section.

**Alternatives.**
- `\p{Cf}` plus five fillers: a second definition, and misses lone marks.
- Leave it: no render rule catches these labels.
- Import std.text's predicate: a kernel package would depend on a stdlib one.

**Consequences.**
- Apps with invisible-only labels get E1802.
- `@keel/check` grows about 25 bytes gzip against 55,798 of 55,808; a trim or a budget raise is needed.

**Amendment (red team 7, M3 and L1).**
- D4: a named character reference in a literal JSX `label` does not count as a visible character, so `label="&zwnj;"` and `label="&copy;"` alone are E1802; numeric references are decoded first, as before.
- D5: a control character (`Cc`) does not count as visible for E1802.
- Consequence: no table of named references is shipped; an author who wants `©` in a label writes the character. k.a11y stays at 6,000 characters by prose trims.
