# ADR-0227: std.messages and std.i18n: exact plural forms (`'=0'`) (RFC 0205)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** A plural message picks a form by the CLDR category `Intl.PluralRules` selects. `zero` is a category, not the number 0, and none of the eleven supported locales selects it, nor `two` or `few`; `ja-JP`, `ko-KR` and `zh-CN` select only `other`. A `zero` form type-checks, parses and never renders, and a message cannot say "No receipts yet" for 0.

**Decision.**
- A plural form keyed `'=n'`, `n` a non-negative safe integer in canonical decimal, is an exact form. It applies when the number is `n`, before the category form, then `other`. `#` is replaced in it.
- The match is in std.i18n `plural`, the one plural path. `PluralForms` and the locale-file plural type gain a ``[exact: `=${number}`]`` index.
- In a message set another key starting with `=` fails with rule `format`.
- New E2407 in a locale file: a category form the file's locale never selects, or a malformed `=` key. Fix: `zero` becomes `'=0'` (removed beside one); another dead category form is removed; none for a malformed key.

**Alternatives.**
- A nested `exact: { 0: … }` object: a second shape for one choice.
- Reading `zero` as 0 where the locale lacks the category: changes a CLDR word Keel shares with `Intl`.
- Exact match in `formatMessage` only: a second plural path.
- Fractional or negative exact keys: no message needs them.

**Consequences.** "None yet" text is `'=0'` in every locale. `keel check` names each dead plural form, so a translator learns that `one` never renders in `ja-JP`. std.i18n and std.messages read `proposed` until the build and conformance land.
