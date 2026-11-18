# RFC 0116: std.text: a value shows a character, and no bidi control

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0328. ADR-0138 records it.

## Problem
std.text says a `line` or `para` value has "a character outside `White_Space` unless empty" and forbids the bidi embeddings, overrides and isolates (U+202A to U+202E, U+2066 to U+2069). `packages/std-text/src/textCheck.ts` does exactly that, and so accepts text a reader cannot see or that reorders what they see:
- Values that show nothing: `'\u200B'` (ZERO WIDTH SPACE), `'\u3164'` (HANGUL FILLER), `'\uFEFF'` (ZERO WIDTH NO-BREAK SPACE), `'\u{E0041}'` (a tag character). None is `White_Space`, so each passes as a one-grapheme title.
- The bidi marks U+200E (LRM), U+200F (RLM) and U+061C (ALM): they change how neighbouring neutral characters are ordered, as the forbidden embeddings do, and are not in the forbidden set.

A name or title that is blank on screen, or that reads differently from its stored order, defeats what `line` is for: text a person writes and reads.

## Proposal
Two Unicode properties, read with the JS engine's `u`-flag regex property escapes (both valid in V8, SpiderMonkey and JavaScriptCore):
- **Visible character.** A non-empty value holds at least one character outside `White_Space` and `Default_Ignorable_Code_Point` (`/[^\p{White_Space}\p{Default_Ignorable_Code_Point}]/u`). The test is on the whole value, so a ZWJ emoji sequence (`👨‍👩‍👧`), a variation selector (`'\u2764\uFE0F'`), a joiner between letters (`'a\u200Db'`) and a subdivision flag (U+1F3F4 with tag characters) stay valid: each has a visible character. U+3164 HANGUL FILLER is `Default_Ignorable_Code_Point` (listed in `Other_Default_Ignorable_Code_Point` in Unicode 15 and later; Node 24, Unicode 17, reports `true`), so `'\u3164'` alone is rejected, as are U+115F, U+1160 and U+FFA0.
- **No bidi control.** The whole `Bidi_Control` set is forbidden: U+061C, U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069 (`\p{Bidi_Control}`; Node 24 lists exactly these twelve). The existing ten-character set becomes this property, adding the three marks.

`para` keeps its one difference, U+000A. The empty value stays valid only where `min` is 0.

## Alternatives
- Forbid every `Default_Ignorable_Code_Point` character: rejects ZWJ sequences, variation selectors and flags, which readers see as one character.
- Forbid tag characters (U+E0000 to U+E007F) outside an emoji tag sequence: closes a hidden run after a visible character (`'a\u{E0041}'`), at the cost of parsing emoji tag sequences. Left out: the value still shows a reader what it shows, and the hidden run is the app's to strip where text goes to a machine.
- A hand-kept list of invisible characters: drifts from Unicode; the property is maintained with the engine.

## Choices
- C1: the visible-character test is on the whole value (as accepted), so `'a\u{E0041}'` and `'\uFEFFx'` stay valid; only values that show nothing are rejected.
- C2: the property tables are the engine's (`\p{…}`), not a copy in the package: no bytes, and the sets named here are the same in the engines Keel supports.

## Spec diff
std.text, the `line` bullet, whole new text:
```
- `line({ min = 1, max })` is a format type over `s.string()` named `line(<min>..<max>)`, not registered: the value is NFC (`v.normalize('NFC') === v`) and has no control character (Unicode `Cc`), no U+2028 or U+2029, no `Bidi_Control` character (U+061C, U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069), a character outside `White_Space` and `Default_Ignorable_Code_Point` unless empty, and `min` to `max` graphemes. `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`; other bounds throw. Its type is `Format<string, 'line(<min>..<max>)'>`, so a value of one bound is not assignable to another.
```
Conformance, appended as the last bullet:
```
- `line({ max: 3 })` rejects `'\u{200B}'`, `'\u{3164}'`, `'\u{FEFF}'`, `' \u{E0041}'`, `'a\u{200E}b'`, `'a\u{200F}'` and `'a\u{61C}'`, each with rule `format`, and accepts `'\u{2764}\u{FE0F}'` and `'a\u{200D}b'`.
```
Section length 4,170 to 4,408 characters (1,043 to 1,102 tokens).

## Conformance diff
One `rfc:0116` commit by the `conformance-writer`:
- New `packages/std-text/conformance/invisible.test.ts`, citing the new bullet, with the seven rejections and two acceptances; a property: for generated non-empty strings built only from `White_Space` and `Default_Ignorable_Code_Point` characters (no `Cc`, no `Bidi_Control`), `line({ max: 10 })` rejects each with rule `format`.
- `packages/std-text/conformance/line-para.test.ts`, the independent oracle: `BIDI` (lines 19-28) becomes `/\p{Bidi_Control}/u`; `BLANK` (line 30) becomes a test that no character is outside `White_Space` and `Default_Ignorable_Code_Point`; `lineOk` (line 34) uses both. Without it the properties at lines 64 and 80 fail against the new rule.
- `line-para.test.ts:47-55`: the title says "a `Bidi_Control` character" in place of "a bidi embedding, override or isolate", and the `forbidden` arbitrary adds `0x061c`, `0x200e` and `0x200f`.
- `gen-roundtrip.test.ts` needs no change; the generator in `textFormat.ts` must stop producing values the new rule refuses (package lane).

## Migration
A stored `line` or `para` value that holds a bidi mark, or that shows nothing, now fails `parse` with rule `format`. Such values were invisible or reordered on screen. An app that parses stored rows meets them as a decode error on read (k.schema) and fixes or drops them; none exist in the repo's golden apps or fixtures.

## Build order
1. Orchestrator: `spec/std/std.text.md` (done with this RFC). The `conformance-writer`: the conformance diff above.
2. One std-text lane owns `packages/std-text/src/textCheck.ts` (the `Bidi_Control` class in place of the two ranges, the visible-character test in place of `BLANK`, the doc comment), `packages/std-text/src/textFormat.ts` (its generator replaces a value with no visible character, as it replaces a blank one now, and drops `Bidi_Control` characters), `packages/std-text/test/**`, `packages/std-text/README.md`, and a changeset (`@keel/std-text` minor: values it accepted are refused). It runs `check`, `build`, the std-text suite once and `pnpm budgets` (`@keel/std-text` at 1.5kb).
3. Orchestrator: ledger, backlog 0328 closed, HANDOFF.

## Token impact
std.text 1,043 to 1,102 tokens (4,170 to 4,408 characters). No other section changes.

## Amendment (red team 6, finding 3 and LOW 9)
`line` and `para` still accepted values that show nothing: U+2800 (BRAILLE PATTERN BLANK, the common "invisible name"), U+FFF9 to U+FFFB (interlinear annotation), U+13430 (an Egyptian format control) and a value made only of combining marks (`'\u{301}'`). None is `White_Space` or `Default_Ignorable_Code_Point`. They also accepted a lone surrogate (`'a\u{D800}'`), which node:sqlite stores as U+FFFD and a Postgres `jsonb` write refuses, so the stored value is not the one that was checked.

The visible character a non-empty value must hold is now one outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cf` (format) and `M` (marks), and U+2800. `Cf` covers U+FFF9 to U+FFFB and U+13430; `M` refuses a value of marks with no base. The test stays on the whole value, so the accepted cases of bullet 10 still pass: `'\u{2764}\u{FE0F}'` holds U+2764 (`So`) and `'a\u{200D}b'` holds `a`; a ZWJ sequence or a variation selector after a visible character stays valid (`'a\u{200D}'`). A value is also refused when it holds a lone surrogate (`Cs`), with rule `format`. Under the `u` flag `\p{Cs}` matches exactly the unpaired surrogates of a string, so the rule is one more class in the forbidden set, in the words the bullet already uses for `Cc`.

Choices the operator can reverse:
- A1: private use (`Co`) and unassigned code points (`Cn`, noncharacters included) still count as visible. Fonts and apps give private use characters glyphs, and `Cn` changes with each Unicode release, so refusing them would make `parse` follow the engine's Unicode version.
- A2: lone surrogates are refused in `line` and `para` only, not in every `s.string`: `s.string` holds machine strings, which k.schema does not restrict.

Spec diff (std.text, 1,108 to 1,185 tokens): in the `line` bullet, "no lone surrogate (`Cs`)," follows "no control character (Unicode `Cc`),", and "a character outside `White_Space` and `Default_Ignorable_Code_Point` unless empty" becomes "a visible character unless empty (one outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cf` and `M`, and U+2800)". Bullet 10 is unchanged. Conformance, appended as bullet 11:
```
- `line({ max: 3 })` rejects `'\u{2800}'`, `'\u{FFF9}'`, `'\u{FFFB}'`, `'\u{13430}'`, `'\u{301}'`, `'\u{301}\u{302}'` and `'a\u{D800}'`, each with rule `format`, and accepts `'\u{2800}a'`, `'q\u{301}'` and `'a\u{200D}'`.
```

Conformance writer: a new `packages/std-text/conformance/blank.test.ts` citing bullet 11, and the oracle in `line-para.test.ts` (its visible-character test and forbidden set) widened the same way, or its properties fail against the new rule. Builder: `packages/std-text/src/textCheck.ts` (`VISIBLE` becomes `/[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cf}\p{M}⠀]/u`; `\p{Cs}` joins `LINE` and `PARA`), the generator in `textFormat.ts` stops producing refused values, the README, and a changeset (`@keel/std-text` minor: values it accepted are refused).
