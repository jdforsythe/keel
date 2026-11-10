# @keel/std-text

**Spec:** std.text · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `graphemes(s): number` (extended grapheme clusters, UAX #29, by `Intl.Segmenter`), `truncate(s, max): string` (`s` at or under `max` graphemes, else the first `max - 1` graphemes with trailing white space removed, then `…`; `truncate('Crème brûlée', 6)` is `Crème…`), `compareText(a, b, locale): -1 | 0 | 1` (the sign of `new Intl.Collator(locale).compare(a, b)`).
- **Invariants:** no export reads the host locale or time zone; `truncate` never splits a grapheme and throws unless `max` is an integer of at least 1; `compareText(a, b, l) === -compareText(b, a, l)`.
- **Dependencies:** `@keel/schema`, `@keel/std-i18n`.
- **Rungs:** conformance (example + probabilistic), properties for `compareText` transitivity and the `truncate` bound.

## Extension points

Uses the **schema type registry** (k.schema `s.register`).

## Unsafe

count: 0
