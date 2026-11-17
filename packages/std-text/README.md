# @keel/std-text

**Spec:** std.text · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `line({ min = 1, max })` (format type `line(<min>..<max>)`: NFC, no control character, U+2028, U+2029 or `Bidi_Control` character, a character outside `White_Space` and `Default_Ignorable_Code_Point` unless empty, `min` to `max` graphemes; type `Format<string, 'line(<min>..<max>)'>`), `para({ min = 1, max })` (`line` that also allows U+000A, `para(<min>..<max>)`), `Email` (ASCII `local@domain`, at most 254 characters, kept as written), `Slug` (1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs), `graphemes(s): number` (extended grapheme clusters, UAX #29, by `Intl.Segmenter`), `truncate(s, max): string` (`s` at or under `max` graphemes, else the first `max - 1` graphemes with trailing white space removed, then `…`; `truncate('Crème brûlée', 6)` is `Crème…`), `compareText(a, b, locale: Locale): -1 | 0 | 1` (the sign of `new Intl.Collator(locale).compare(a, b)`).
- **Invariants:** importing the package registers `text.Email` and `text.Slug` (idempotent). Every rejection by `line`, `para`, `Email` or `Slug` has rule `format`. `line` and `para` bounds are integers with `0 <= min <= max` and `1 <= max <= 10000`; other bounds throw. No export reads the host locale or time zone; `truncate` never splits a grapheme and throws unless `max` is an integer of at least 1; `compareText(a, b, l) === -compareText(b, a, l)`.
- **Dependencies:** `@keel/schema`, `@keel/std-i18n`.
- **Rungs:** conformance (example + probabilistic), properties for `compareText` transitivity, the `truncate` bound and idempotence, and `para` accepting every `line` value; type tests for the bound brands.

## Extension points

Uses the **schema type registry** (k.schema `s.register`). It registers the format types `text.Email` and `text.Slug` (k.schema `s.format`); `line` and `para` are format types made per bound and not registered.

## Unsafe

count: 0
