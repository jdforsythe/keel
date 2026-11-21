# RFC 0152: k.schema: one blank set for `required`, and a JSON Schema pattern every consumer reads alike

Status: implemented (ADR-0174) under the RFC defaults (6: enforce in the kernel; 1: one way per thing), for the orchestrator to confirm. For backlog 0469.

## Decisions
- D1: a `string` with `min` >= 1 refuses a blank value with rule `required`. Blank: no character outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cc`, `Cf`, `Cs` and `M`, and U+2800. This is the set `keel check` already reads as blank for an a11y-required `label` (k.a11y E1802, `packages/check/src/rules/blankLabel.ts`), so a value a person sees as empty is refused the same way in a form, a store and a label.
- D2: the JSON Schema derivations (MCP tool schemas in `@keel/cli`, OpenAPI in `@keel/router`) add, for `min` >= 1, one `pattern` written only as a negated class of `\uXXXX` ranges: the blank set's characters below U+10000 other than `M` and `Cs`. ECMA-262 (with or without the `u` flag) and Python `re` read such a pattern alike; `\S` and `\p{…}` they do not.
- D3: the pattern is a necessary condition, not the rule: a value of combining marks only, of lone surrogates, or of blank characters above U+FFFF passes the pattern and fails `parse`. `parse` decides.
- D4: k.schema with this RFC, RFC 0153 and RFC 0154 is 1,629 tokens, over the 1,500-token section budget. The Format types paragraph and its Conformance bullet move word for word into a new kernel section, k.formats, rather than the budget being re-based (the orchestrator's call, as k.opening was split from k.return). E1106 and the rule `format` stay in k.schema: E1106's checker rule and explanation name k.schema as their `see`.

## Problem
`leafRule.ts` refuses a `string` with `min` >= 1 when `/\S/` finds nothing. JavaScript's `\s` is the `White_Space` property plus U+FEFF, so values a person sees as blank pass `required`: `'​'` (ZERO WIDTH SPACE), `'⁠'` (WORD JOINER), `'᠎'`, `'ㅤ'` (HANGUL FILLER), `'‎'` (LRM) and a lone combining mark (`'́'`). `s.string({ min: 1 }).parse('​')` is `ok`, so a required name can be stored empty on screen.

The JSON Schema derivations write `pattern: "\\S"`, and consumers disagree on it: Python `re` reads `'\x1c'` to `'\x1f'` and `'\x85'` as whitespace (JavaScript does not), and U+FEFF the other way. A Python MCP client or OpenAPI validator accepts or refuses values the server's `parse` decides otherwise.

## Proposal
- `packages/schema/src/internal/isBlank.ts`: `!/[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cs}\p{M}⠀]/u.test(text)`. `leafRule` (rule `required`), `blankAbsent` (`decodeStrings` drops a blank optional) and `gen` (a `min` >= 1 string is never blank) all read it, so the three agree.
- `packages/schema/src/internal/blankPattern.ts`, exported from `@keel/schema/internal` (not app-facing): the pattern string below. `packages/cli/src/internal/toJsonSchema.ts` and `packages/router/src/internal/jsonSchemaOf.ts` use it in place of `"\\S"`.

The pattern, from Node 24 (Unicode 17) tables, 21 ranges:
```
[^\u0000- \u007F- ­؀-؅؜۝܏࢐࢑࣢ᅟᅠ ᠎ -‏ -  -⁯⠀　ㅤ﻿ﾠ￰-￻]
```
Without the `u` flag an astral character is two surrogate code units, each outside the class, so ECMA-262 matches it, as Python does the one code point: the two agree on every string.

## Alternatives
- Keep `\S` and state the gap: leaves required fields blank on screen, and the Python disagreement.
- Only `White_Space` plus `Default_Ignorable_Code_Point` (std.text's set without `Cf`, `M`, `Cc`): a lone combining mark and `Cf` controls such as U+0600 stay "filled"; k.a11y already reads them as blank, so two sets would remain.
- `\p{…}` in the JSON Schema pattern: exact, but Python `re` raises on `\p`, and ECMA-262 needs the `u` flag, which JSON Schema validators set inconsistently.
- Trim before `required`: parsing never trims (RFC 0091); unchanged.

## Spec diff
k.schema, Primitives, the `string` entry:
```
`string` (`{ min, max }`; with `min` >= 1, a blank value fails rule `required` (no character outside `White_Space`, `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Cs`, `M`, U+2800); JSON Schema adds a `pattern` of `\u` ranges for its BMP part but `M` and `Cs`, read alike by ECMA-262 and Python)
```
k.schema, `decodeStrings`: "as is only whitespace for a `string` with `min` >= 1" becomes "as is a blank value for a `string` with `min` >= 1".
k.schema, Conformance, the bullet "`s.string({ min: 1 })` fails `''` and `' '` …" becomes:
```
- `s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional; the JSON Schema `pattern` refuses exactly the blank values without `M`, `Cs` or non-BMP characters.
```
Rewordings that keep meaning, to make room: SchemaError's shape is cited from k.errors ("the KeelError `schema.invalid` (k.errors) with `data: { issues: … }`"); Format types' `decodeStrings` clause is shortened without change.

Section length: 5,988 to 6,240 characters (1,497 to 1,560 tokens), over the 1,500-token section budget (B0001); with RFC 0153 and 0154, 6,514 characters (1,629 tokens). D4 splits it:
- k.schema: the Format types paragraph and the Conformance bullet "For a fixture format type, …" are removed; Primitives gains "`s.format`: k.formats." after "`s.secret` and `.pii(class)`: k.privacy." RFC 0153's open-object `Secret` bullet becomes Conformance bullet 15. 5,661 characters (1,416 tokens).
- New `spec/kernel/k.formats.md` (Format types, status `implemented` until the conformance commit retags its tests' headers, then `conformance-covered`): a two-sentence intro (a format type narrows a schema by a predicate; the stdlib's dates, text and messages are format types and app code declares none, E1106 in k.schema), the Format types paragraph and the one Conformance bullet, both word for word. 1,097 characters (275 tokens).
- `spec/00-map.md`: a k.formats row after k.schema, paid for by shortening nine titles in the map only ("and" to a comma in six; "Server boundary", "Entry, deploy files", "Queued defaults"). 4,799 characters (1,200 tokens).
- std.text, std.temporal, std.messages and their package READMEs cite k.formats for format types; `packages/schema/README.md` lists k.formats; `docs/freeze-review.md` and `docs/ROADMAP.md` count the new section.

## Conformance diff
By the `conformance-writer`, under `rfc:0152`:
- `packages/schema/conformance/blank-required-0091.test.ts`: the first test's values become `''`, `' '`, `'​'`, `'ㅤ'`, `'́'`; the `whitespace` arbitrary draws from the whole blank set (a property: every non-empty string of blank characters fails `required` for every `min` >= 1, and `decodeStrings` drops it for an optional key); a non-blank value that has one character outside the set and is shorter than `min` still fails `min`.
- New `packages/cli/conformance/json-schema-blank.test.ts` (MCP input schema of a `min: 1` string): the `pattern` matches `/^\[\^(\\u[0-9A-F]{4}(-\\u[0-9A-F]{4})?)+\]$/` (only `\u` ranges); for every BMP code point `c`, `new RegExp(pattern).test(c)` is false exactly when `c` is in the blank set and not `M` or `Cs`; an astral character and `'́'` match.
- `packages/router/conformance/` (OpenAPI parameter of a `min: 1` string): the same `pattern`.

D4 retags, header text only, no assertion changes; the ledger (`keel ledger`, `citesClause`) counts a test toward a clause only when its `// Spec:` header names the clause's section:
- `packages/schema/conformance/format-type.test.ts` and `packages/cli/conformance/schema-format-json-schema.test.ts`: `// Spec: k.schema, clause "For a fixture format type, …"` becomes `// Spec: k.formats, …` (k.formats#1).
- `packages/check/conformance/E1106-format-in-app.test.ts`: the Rules quote stays on k.schema; its Conformance quote "`s.format` in an app file is E1106." moves to a `// Spec: k.formats` block.
- `packages/schema/conformance/format-type-check-throw.test.ts`, `format-type-node.test.ts`, `format-type-brand.test.ts`, `format-type-base-first.test.ts`, `format-type-base-derivations.test.ts`: prose quotes of the Format types paragraph, `k.schema` becomes `k.formats` (not counted by the ledger; the section they quote).
Then `pnpm ledger`: k.formats#1 comes in at `probabilistic`, k.schema#15 is the open-object `Secret` bullet with RFC 0153's evidence, and k.formats becomes `conformance-covered` in its file and the map.

## Migration
A stored value with `min` >= 1 that holds only characters now blank fails `parse` with rule `required`; such values show as empty. None in the repo's golden apps or fixtures. A JSON Schema consumer gets a longer `pattern`; one that accepted `\S` accepts it.

## Token impact
k.schema +63 tokens. With D4: k.schema 1,416 tokens after all three RFCs; k.formats 275, new; map 1,200 (was 1,197).

## Known limits
- k.schema is at its section budget before this RFC (1,497 of 1,500 tokens). With RFC 0153 and 0154 the section reaches 1,629 tokens. Cutting other meaning to fit is not done here; Format types moves to k.formats (D4).
- The set follows the engine's Unicode tables (`\p{…}`); the pattern string is fixed at build. A character a later Unicode version adds to the set is blank to `parse` and passes the pattern until the pattern is regenerated.
- std.text's `line` keeps its own visible-character text (no `Cc`, `Cs` there because `line` refuses those outright); k.a11y cites std.text. One shared definition in k.schema for both is left to backlog 0804.

## Build order
1. This commit: RFC, ADR, the spec diff above. 2. `conformance-writer`: the conformance diff. 3. Build: `isBlank`, `blankPattern` and `gen` in `@keel/schema` (bundle +about 90 B gzip; the package is 3 B under its 5.5 kB budget, so the build re-bases it under RFC default 7 or finds room), then `@keel/cli` and `@keel/router`.
