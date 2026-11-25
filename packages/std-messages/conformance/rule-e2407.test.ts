// Spec: std.messages, clause "E2401 to E2407 each have a triggering fixture and a clean one; E2407 triggers for `zero` in `en-US`, `one` in `ja-JP` and `'=01'`, and not for `many` in `fr-FR` or `'=0'`; the fixes of E2401 (`load` form), E2403, E2404, E2405 and E2407 apply with `git apply`, and re-checking reports no diagnostic of that code."
// std.messages, Rules "E2407 a plural form in a locale file that never applies: a category form the file's locale never selects (`new Intl.PluralRules(<locale>).resolvedOptions().pluralCategories` lacks it), or a key starting with `=` that is not an exact form (fix: `zero` becomes `'=0'`, or is removed beside an `'=0'`; another never-selected category form is removed; none for a malformed `=` key). Its messages: `plural form many never applies in de-DE`, with `; '=0' matches 0` added for `zero`, and `'=01' is not an exact plural form: = then a whole number, as '=0'`."
// E2401 to E2406 triggering and clean fixtures and their fixes are in rules-e2401-e2406.test.ts; this file holds E2407 and the E2407 fix.
// Seed 1337 (no random inputs; fixtures are fixed trees from ./fixtures/support.ts)
import "@keel/std-messages/tools";
import { expect, test } from "vitest";
import { CLEAN, applyFix, codesOf, tree } from "./fixtures/support.ts";

const LOCALE_SCHEMA = "modules/recipes/AppLocale.schema.ts";
const file = (locale: string) => `modules/recipes/RecipesText/${locale}.ts`;

const entry = (count: string) =>
  `import { RecipesText } from '../RecipesText.schema.ts'\nexport default RecipesText.text({ title: 'T', count: ${count}, total: { text: 'Total {n}' } })\n`;
const locales = (...tags: string[]) =>
  `import { s } from '@keel/schema'\nexport const AppLocale = s.enum([${tags.map((t) => `'${t}'`).join(", ")}])\n`;

/** The clean module with `locale`'s file replaced (and the locale added to the app's enum when it is not one of the two). */
function withCount(locale: string, count: string) {
  const extra = locale === "en-US" || locale === "de-DE" ? {} : { [LOCALE_SCHEMA]: locales("en-US", "de-DE", locale) };
  return tree({ ...extra, [file(locale)]: entry(count) });
}

test("E2401 to E2407 each have a triggering fixture and a clean one; E2407 triggers for `zero` in `en-US`, `one` in `ja-JP` and `'=01'`, and not for `many` in `fr-FR` or `'=0'`; the fixes of E2401 (`load` form), E2403, E2404, E2405 and E2407 apply with `git apply`, and re-checking reports no diagnostic of that code.", () => {
  expect(codesOf(tree(), "E2407")).toEqual([]);
  // triggers: `zero` in `en-US`, `one` in `ja-JP`, `'=01'`
  expect(codesOf(withCount("en-US", "{ plural: 'n', zero: 'none', one: '# a', other: '# b' }"), "E2407").length).toBe(
    1,
  );
  expect(codesOf(withCount("ja-JP", "{ plural: 'n', one: '# a', other: '# b' }"), "E2407").length).toBe(1);
  expect(codesOf(withCount("en-US", "{ plural: 'n', '=01': 'x', other: '# b' }"), "E2407").length).toBe(1);
  // does not trigger: `many` in `fr-FR`, `'=0'`
  expect(codesOf(withCount("fr-FR", "{ plural: 'n', one: '# a', many: '# m', other: '# b' }"), "E2407")).toEqual([]);
  expect(codesOf(withCount("en-US", "{ plural: 'n', '=0': 'none', one: '# a', other: '# b' }"), "E2407")).toEqual([]);
  expect(codesOf(withCount("ja-JP", "{ plural: 'n', other: '# b' }"), "E2407")).toEqual([]);
  // a fix applies with `git apply`, and re-checking reports no E2407
  for (const [locale, count] of [
    ["en-US", "{ plural: 'n', zero: 'none', one: '# a', other: '# b' }"],
    ["en-US", "{ plural: 'n', '=0': 'none', zero: 'none', one: '# a', other: '# b' }"],
    ["ja-JP", "{ plural: 'n', one: '# a', other: '# b' }"],
    ["de-DE", "{ plural: 'n', one: '# a', many: '# m', other: '# b' }"],
    ["en-US", "{ plural: 'n', two: '# t', few: '# f', one: '# a', other: '# b' }"],
  ] as const) {
    const files = withCount(locale, count);
    const d = codesOf(files, "E2407");
    expect(d.length).toBeGreaterThan(0);
    const fix = d[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) continue;
    expect(codesOf(applyFix(files, fix), "E2407")).toEqual([]);
  }
});

test("E2407 a plural form in a locale file that never applies: a category form the file's locale never selects (`new Intl.PluralRules(<locale>).resolvedOptions().pluralCategories` lacks it), or a key starting with `=` that is not an exact form (fix: `zero` becomes `'=0'`, or is removed beside an `'=0'`; another never-selected category form is removed; none for a malformed `=` key). Its messages: `plural form many never applies in de-DE`, with `; '=0' matches 0` added for `zero`, and `'=01' is not an exact plural form: = then a whole number, as '=0'`.", () => {
  // a category form the file's locale never selects: message names the form and the locale
  const many = codesOf(withCount("de-DE", "{ plural: 'n', one: '# a', many: '# m', other: '# b' }"), "E2407");
  expect(many.map((d) => d.message)).toEqual(["plural form many never applies in de-DE"]);
  expect(many[0]?.path).toBe(file("de-DE"));
  // `zero` adds that '=0' matches 0; its fix makes it '=0'
  const zeroFiles = withCount("en-US", "{ plural: 'n', zero: 'none', one: '# a', other: '# b' }");
  const zero = codesOf(zeroFiles, "E2407");
  expect(zero.map((d) => d.message)).toEqual(["plural form zero never applies in en-US; '=0' matches 0"]);
  const zeroFix = zero[0]?.fix;
  expect(typeof zeroFix).toBe("string");
  if (zeroFix !== undefined) {
    const out = applyFix(zeroFiles, zeroFix).find((f) => f.path === file("en-US"))?.source ?? "";
    expect(out).toContain("'=0': 'none'");
    expect(out).not.toMatch(/\bzero\b/);
  }
  // `zero` beside an '=0' is removed
  const both = withCount("en-US", "{ plural: 'n', '=0': 'none', zero: 'nil', one: '# a', other: '# b' }");
  const bothFix = codesOf(both, "E2407")[0]?.fix;
  expect(typeof bothFix).toBe("string");
  if (bothFix !== undefined) {
    const out = applyFix(both, bothFix).find((f) => f.path === file("en-US"))?.source ?? "";
    expect(out).toContain("'=0': 'none'");
    expect(out).not.toContain("nil");
    expect(out).not.toMatch(/\bzero\b/);
  }
  // another never-selected category form is removed
  const one = withCount("ja-JP", "{ plural: 'n', one: '# a', other: '# b' }");
  const oneFix = codesOf(one, "E2407")[0]?.fix;
  expect(typeof oneFix).toBe("string");
  if (oneFix !== undefined) {
    const out = applyFix(one, oneFix).find((f) => f.path === file("ja-JP"))?.source ?? "";
    expect(out).not.toContain("# a");
    expect(out).toContain("other: '# b'");
  }
  // a key starting with `=` that is not an exact form: its own message, no fix
  const bad = codesOf(withCount("en-US", "{ plural: 'n', '=01': 'x', other: '# b' }"), "E2407");
  expect(bad.map((d) => d.message)).toEqual(["'=01' is not an exact plural form: = then a whole number, as '=0'"]);
  expect(bad[0]?.fix).toBeUndefined();
  // the catalog is the file's locale, not the set's: `many` is fine in `fr-FR`
  expect(codesOf(withCount("fr-FR", "{ plural: 'n', many: '# m', other: '# b' }"), "E2407")).toEqual([]);
});
