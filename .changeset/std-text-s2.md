---
"@keel/std-text": minor
---

`@keel/std-text` exports `graphemes(s)`, the `Intl.Segmenter` grapheme count; `truncate(s, max)`, the first `max - 1` graphemes with trailing white space removed and `…` when `s` has more than `max`; and `compareText(a, b, locale)`, the sign of `Intl.Collator(locale).compare` for an explicit std.i18n `Locale` (std.text). None reads the host locale or time zone.
