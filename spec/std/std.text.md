# std.text: Text
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-text` registers `text.Email` and `text.Slug`, format types (k.schema `s.format`) over `s.string()`. It depends on `@keel/std-i18n` for `Locale`. A grapheme is an extended grapheme cluster (Unicode UAX #29), what a reader counts as one character.

**API** (`@keel/std-text`; client-safe, no config).
```ts
import { line, para, Email, compareText } from '@keel/std-text'
export const Recipe = s.object({ title: line({ max: 80 }), notes: para({ max: 2000 }).optional(), by: Email })
props.data.recipes.toSorted((a, b) => compareText(a.title, b.title, props.params.locale))
```
- Text a person writes and reads (titles, names, notes) is `line` or `para`; `s.string` holds machine strings (codes, tokens, keys).
- `line({ min = 1, max })` is a format type over `s.string()` named `line(<min>..<max>)`, not registered: the value is NFC (`v.normalize('NFC') === v`) and has no control character (Unicode `Cc`), no U+2028 or U+2029, no bidi embedding, override or isolate (U+202A to U+202E, U+2066 to U+2069), and `min` to `max` graphemes. `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`; other bounds throw. Its type is `Format<string, 'line(<min>..<max>)'>`, so a value of one bound is not assignable to another.
- `para({ min = 1, max })` is `line` that also allows U+000A, named `para(<min>..<max>)`.
- `Email` (`text.Email`) is ASCII `local@domain` of at most 254 characters: `local` is 1 to 64 characters of dot-separated atoms of letters, digits and ``!#$%&'*+/=?^_`{|}~-``; `domain` is two or more dot-separated labels of 1 to 63 letters, digits and inner hyphens, the last all letters. It is kept as written, with no case folding.
- `Slug` (`text.Slug`) is 1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs.
- `graphemes(s: string): number` counts graphemes with `Intl.Segmenter` (`granularity: 'grapheme'`).
- `truncate(s: string, max: number): string` is `s` when it has at most `max` graphemes; otherwise its first `max - 1` graphemes with trailing white space removed, then `…` (U+2026). `max` is an integer of at least 1; any other throws.
- `compareText(a: string, b: string, locale: Locale): -1 | 0 | 1` is the sign of `new Intl.Collator(locale).compare(a, b)`.

**Rules.** None. `localeCompare` without a locale is E1758 (k.check).

**Conformance.**
- After importing `@keel/std-text`, the registry maps `text.Email` and `text.Slug` to the exports; importing it again does not throw.
- For every value `gen` produces for `line({ max: 80 })`, `line({ min: 0, max: 3 })`, `para({ max: 2000 })`, `Email` and `Slug`, `parse` accepts it and `parse(encode(v))` returns it; each `line({ max: 80 })` value has 1 to 80 graphemes, and `line({ max: 80 }).doc()` is `line(1..80)`.
- `line({ max: 3 })` accepts three `👨‍👩‍👧` (24 code units) and rejects four; it rejects `''`, `'a\nb'`, `'a‮b'`, `'a\u0007'` and `'é'` (not NFC), each with rule `format`. `para({ max: 3 })` accepts `'a\nb'` and rejects `'a\r\nb'`.
- `line({ max: 0 })`, `line({ min: 2, max: 1 })` and `line({ max: 1.5 })` throw.
- `Email` accepts `a.b+c@example.co` and rejects `a@b`, `a..b@example.com`, `é@example.com`, `@example.com` and a 255-character address; `Slug` accepts `pasta-bake-2` and rejects `Pasta`, `-a`, `a--b` and `''`. Each rejection has rule `format`.
- `graphemes` is 1 for `👨‍👩‍👧` and for `'é'`, 0 for `''`, and `s.length` for every generated ASCII string.
- For every generated string `s` and `max` from 1 to 20, `graphemes(truncate(s, max)) <= max`; `truncate(s, max) === s` exactly when `graphemes(s) <= max`; otherwise the result ends with `…` and the graphemes before it begin `s`, none split. `truncate('Crème brûlée', 6)` is `Crème…`.
- For generated `a`, `b` and every `Locale` `l`, `compareText(a, b, l)` is the sign of `new Intl.Collator(l).compare(a, b)` and equals `-compareText(b, a, l)`; `compareText('ä', 'b', 'de-DE')` is `-1`.
- With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.
