---
"@keel/std-text": minor
---

`@keel/std-text` holds text a person writes and reads (std.text). `line({ min, max })` and `para({ min, max })` are format types over `s.string()` bounded by graphemes, NFC, without control characters, U+2028, U+2029 or bidi controls (`para` allows U+000A), typed `Format<string, 'line(<min>..<max>)'>`. `Email` and `Slug` are format types registered as `text.Email` and `text.Slug` on import. `graphemes(s)` is the `Intl.Segmenter` grapheme count; `truncate(s, max)` is the first `max - 1` graphemes with trailing white space removed and `…` when `s` has more than `max`; `compareText(a, b, locale)` is the sign of `Intl.Collator(locale).compare` for an explicit std.i18n `Locale`. None reads the host locale or time zone.
