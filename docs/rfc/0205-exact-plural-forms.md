# RFC 0205: std.messages and std.i18n: exact plural forms (`'=0'`)

Status: implemented (ADR-0227), accepted by the orchestrator on 2026-11-24. Amends std.i18n (`PluralForms`, `plural`, Conformance) and std.messages (Extension points, the entry bullet, new **Plurals**, Rules E2407, Conformance). From backlog 1009.

## Decisions
- D1: an exact form is a plural form keyed `'=n'`, `n` a non-negative safe integer in canonical decimal (`'=0'`, `'=1'`, `'=12'`): ICU's spelling, flat beside the category forms.
- D2: an exact form applies when the number is `n`, before any category form; then the category `Intl.PluralRules` selects, then `other`. `#` is replaced in it as in any form.
- D3: the match lives in std.i18n `plural`, the one plural path; std.messages only admits the keys.
- D4: in a message set, another key starting with `=` fails with rule `format`; in a bare `PluralForms` it is never selected.
- D5: one new code, E2407: a plural form in a locale file that never applies, a category the file's locale never selects or a malformed `=` key. Fix: `zero` becomes `'=0'`; another dead category form is removed.

## Problem
`{ plural: 'n', zero: 'No receipts yet', one: '# receipt', other: '# receipts' }` renders `0 receipts` in `en-US`. `zero` is a CLDR category, not the number 0, and `new Intl.PluralRules(l).resolvedOptions().pluralCategories` holds it for none of the eleven `Locale` tags (checked on Node 24: `en-US` and `de-DE` give `one, other`; `es-ES`, `fr-FR`, `it-IT` and `pt-BR` add `many`; `ja-JP`, `ko-KR` and `zh-CN` give `other`). The type, the format rule and `keel check` all accept the form, so the text is dead and nothing says so. There is no way to write "No receipts yet" for 0 short of a second key and a branch in the component (`apps/household` has `empty` beside `count` for that reason).

## Proposal
```ts
// ReceiptsText/en-US.ts
count: { plural: 'n', '=0': 'No receipts yet', one: '# receipt', other: '# receipts' },
// ReceiptsText/de-DE.ts
count: { plural: 'n', '=0': 'Noch keine Belege', one: '# Beleg', other: '# Belege' },
```
- **Keys.** `=` then `0` or a digit 1 to 9 followed by digits, at most `Number.MAX_SAFE_INTEGER`. Not `=-1`, `=1.5`, `=1e3`, `=01` or `= 1`: a count is a whole number, and one spelling per number keeps two keys from naming one value.
- **Selection.** `plural(n, locale, forms)`: the form keyed `=${n}` when `n` is such an integer and the key is present; else the category form; else `other`. So `'=1': 'One receipt'` wins over `one`.
- **Types.** `PluralForms` and the locale file's plural type gain ``readonly [exact: `=${number}`]: string``. TypeScript then refuses `'=x'` but admits `'=1.5'`; the format rule and E2407 refuse what the template type lets through.
- **Message sets.** `messageOk` admits exact keys; `gen` produces some; a malformed `=` key fails with rule `format` at the key's path, so `Set.load` rejects such an entry as it rejects any.
- **E2407.** In a locale file `<Set>/<locale>.ts`: a category form not in `new Intl.PluralRules(<locale>).resolvedOptions().pluralCategories`, or a malformed `=` key. Messages, under 90 characters: `plural form zero never applies in en-US; '=0' matches 0`, `plural form one never applies in ja-JP`, `'=01' is not an exact plural form: = then a whole number, as '=0'`. Fix: `zero` is renamed `'=0'` (removed when an `'=0'` is there); another never-selected category is removed, since it never renders. No fix for a malformed key: `=1.5` has no intended integer.
- `zero`, `two` and `few` stay in the types: they are CLDR categories, and the rule, not the type, knows a file's locale.

## Alternatives
- **`exact: { 0: '...' }` nested.** Two shapes for one choice, and a second object to check; `'=0'` is what translators and ICU tooling already write.
- **Make `zero` mean 0 in locales without the category.** Changes CLDR's meaning of a word Keel shares with `Intl`; in a locale that has `zero` (Arabic, Latvian) it would mean something else.
- **Exact match in `formatMessage` only.** Two plural paths; std.i18n says `plural` is the one.
- **Any number (`=1.5`, `=-1`).** No message needs it; negative or fractional counts are not what plural messages carry.
- **A warning instead of E2407.** The text never renders; an error with a fix costs the author one keystroke.

## Spec diff
Applied in this commit.
- std.i18n (`conformance-covered`): `PluralForms` gains exact keys, `plural` selects them first; one conformance clause.
- std.messages (`conformance-covered`): the example's `de-DE` count has `'=0'`; the entry bullet lists `'=n'?`; new **Plurals** bullet; Extension points E2401 to E2407; Rules E2407; conformance clauses for parse, render, E2407 and seven rules.
- `spec/std/README.md` rows read `proposed`. No map row, no code range change (E2407 is in E240x), no glossary term.

## Conformance
By the `conformance-writer`, from the spec text.
- `packages/std-i18n/conformance/exact-plural.test.ts` (new): the std.i18n exact clause, including the property against the result without exact forms.
- `packages/std-messages/conformance/`: `exact-forms.test.ts` (new) for the parse clause (`'=0'`, `'=12'` accepted; `'=01'`, `'=-1'`, `'=1.5'`, `'=1e3'`, `'= 1'`, `'=x'` rule `format`) and the `formatMessage` clause; `rule-e2407.test.ts` (new, beside `rules-e2401-e2406.test.ts`) for E2407 (triggering fixtures `zero` in `en-US`, `one` in `ja-JP`, `'=01'`; clean `many` in `fr-FR`, `'=0'`; the fix applied with `git apply`); `tools-split.test.ts` takes the export count of seven, in an `rfc:0205` commit.
- The existing "every `gen` entry parses and round-trips" clause now covers generated exact forms.
No existing case contradicts the text: the current cases use category forms only; the std.i18n property over `{ zero, one, two, few, many, other }` holds unchanged.

## Migration
None (unreleased). No app or example has a `zero` form; golden-2's `ja-JP` file has `other` alone.

## Token impact
std.messages about 1,490 to 1,990 tokens; std.i18n about 1,170 to 1,290; both under 3,100. `keel explain E2407` one catalog entry. Map budgets unchanged.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`. 3. Build:
- `packages/std-i18n/src/PluralForms.ts` (or where the type lives) and `plural.ts`: the exact keys and the match.
- `packages/std-messages/src/Message.ts`, `internal/EntryInput.ts` (the template index signature), `internal/messageOk.ts` (exact keys), `internal/genMessage.ts` (generate some).
- `packages/std-messages/src/tools/neverApplies.ts` (new, E2407), `tools/index.ts`, `tools/internal/` helpers for the file's locale and the fix; `packages/check/src/internal/EXPLANATIONS.ts` if the catalog lists rule codes there.
- `apps/household`: `count` gains `'=0'` in both locale files; the page drops the `empty` branch if it reads cleaner.
- Docs: the keel-client skill's message-set paragraph (`'=0'` for "none yet", E2407), the std-messages and std-i18n READMEs, a changeset, `tasks/BACKLOG.md` 1009.

## For the operator
1. **`'=n'` keys, non-negative integers only.** Recommended: accept.
2. **E2407 is an error, and its fix renames `zero` to `'=0'`.** Recommended: accept; the form never renders in any supported locale.
