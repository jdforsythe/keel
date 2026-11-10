// Spec: std.messages, clause "E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code."
// Spec: std.messages Rules E2401, E2402, E2403, E2404, E2405, E2406 (one test per code, each with a triggering and a clean fixture).
// Seed 1337 (no random inputs; fixtures are fixed trees from ./fixtures/support.ts)
import "@keel/std-messages/tools";
import { expect, test } from "vitest";
import { CLEAN, applyFix, codesOf, tree } from "./fixtures/support.ts";

const SET = "modules/recipes/RecipesText.schema.ts";
const DE = "modules/recipes/RecipesText/de-DE.ts";
const EN = "modules/recipes/RecipesText/en-US.ts";
const VIEW = "modules/recipes/RecipeList.tsx";

const de = (entry: string) =>
  `import { RecipesText } from '../RecipesText.schema.ts'\nexport default RecipesText.text(${entry})\n`;
const view = (body: string) =>
  `export default function RecipeList(props) {\n  const t = props.data.text\n  return ${body}\n}\n`;

/** Fix of the first diagnostic of `code` applies with `git apply`, and re-checking reports none of that code. */
function fixesAway(code: string, overrides: Record<string, string | null>) {
  const files = tree(overrides);
  const d = codesOf(files, code);
  expect(d.length).toBeGreaterThan(0);
  const fix = d[0]?.fix;
  expect(typeof fix).toBe("string");
  if (fix === undefined) return;
  expect(codesOf(applyFix(files, fix), code)).toEqual([]);
}

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2401 a locale of the set without `<Set>/<locale>.ts`, or `load` not that exact import", () => {
  expect(codesOf(tree(), "E2401")).toEqual([]);
  expect(codesOf(tree({ [DE]: null }), "E2401").length).toBe(1);
  const wrongLoad = (load: string) => (CLEAN[SET] ?? "").replace(/\(locale\) => import\(.*\)\)$/m, `${load})`);
  expect(codesOf(tree({ [SET]: wrongLoad("(locale) => import('./RecipesText/en-US.ts')") }), "E2401").length).toBe(1);
  fixesAway("E2401", { [DE]: null });
  fixesAway("E2401", { [SET]: wrongLoad("(locale) => import('./RecipesText/en-US.ts')") });
});

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2402 a locale file without a declared key (no fix)", () => {
  expect(codesOf(tree(), "E2402")).toEqual([]);
  const d = codesOf(tree({ [DE]: de("{ title: 'Rezepte', count: { plural: 'n', other: '# Rezepte' } }") }), "E2402");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(DE);
  expect(d[0]?.fix).toBeUndefined();
});

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2403 a locale file key the set does not declare (fix removes it)", () => {
  expect(codesOf(tree(), "E2403")).toEqual([]);
  const extra = de(
    "{ title: 'Rezepte', count: { plural: 'n', other: '# Rezepte' }, total: { text: 'Summe {n}' }, extra: 'x' }",
  );
  expect(codesOf(tree({ [DE]: extra }), "E2403").length).toBe(1);
  fixesAway("E2403", { [DE]: extra });
});

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2404 a declared key no other project file reads as `.<key>` (fix removes it from the declaration)", () => {
  expect(codesOf(tree(), "E2404")).toEqual([]);
  const unread = view("<main><h1>{t.title}</h1><p>{t.count}</p></main>");
  const d = codesOf(tree({ [VIEW]: unread }), "E2404");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toContain("total");
  fixesAway("E2404", { [VIEW]: unread });
});

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2405 a template's `{name}`, `plural` or `select` that does not match its key's params (fix renames the placeholder when exactly one declared param is absent from that template)", () => {
  expect(codesOf(tree(), "E2405")).toEqual([]);
  const entry = (total: string, count = "{ plural: 'n', other: '# Rezepte' }") =>
    de(`{ title: 'Rezepte', count: ${count}, total: ${total} }`);
  const renamed = entry("{ text: 'Summe {m}' }");
  expect(codesOf(tree({ [DE]: renamed }), "E2405").length).toBe(1);
  fixesAway("E2405", { [DE]: renamed });
  // A plural on a param the key does not declare: reported, and no single absent param to rename to unless exactly one.
  expect(
    codesOf(tree({ [DE]: entry("{ text: 'Summe {n}' }", "{ plural: 'q', other: '# Rezepte' }") }), "E2405").length,
  ).toBe(1);
  // A select on a key with a number param.
  expect(
    codesOf(tree({ [DE]: entry("{ text: 'Summe {n}' }", "{ select: 'n', cases: { a: 'x' } }") }), "E2405").length,
  ).toBe(1);
  // Two declared params absent from the template: no unambiguous rename, so no fix.
  const two = tree({
    [SET]: (CLEAN[SET] ?? "").replace("total: { n: s.int() }", "total: { n: s.int(), m: s.int() }"),
    [DE]: entry("{ text: 'Summe {z}' }"),
    [EN]: de("{ title: 'Recipes', count: { plural: 'n', other: '# recipes' }, total: { text: 'Total {n} {m}' } }"),
  });
  expect(codesOf(two, "E2405").every((x) => x.fix === undefined)).toBe(true);
});

test.skip("E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code: E2406 a JSX text child, a string literal `label` or `alt`, or a string literal a route `title` returns, containing a letter, in a component or `routes.ts` file (no fix)", () => {
  expect(codesOf(tree(), "E2406")).toEqual([]);
  const jsx = codesOf(tree({ [VIEW]: view("<main><h1>Recipes</h1></main>") }), "E2406");
  expect(jsx.length).toBe(1);
  expect(jsx[0]?.fix).toBeUndefined();
  expect(codesOf(tree({ [VIEW]: view("<main><Input label='Search' /></main>") }), "E2406").length).toBe(1);
  expect(codesOf(tree({ [VIEW]: view("<main><Image alt='A pie' /></main>") }), "E2406").length).toBe(1);
  const routes = (title: string) =>
    `import { manifest } from '@keel/router'\nimport RecipeList from './RecipeList.tsx'\nexport const routes = manifest({ 'recipes.list': { path: '/:locale/recipes', component: RecipeList, title: ${title} } })\n`;
  expect(codesOf(tree({ "modules/recipes/routes.ts": routes("() => 'Recipes'") }), "E2406").length).toBe(1);
  // Clean twins: no letter, or not a literal.
  expect(codesOf(tree({ [VIEW]: view("<main><p>{t.title}</p><span>1 / 2</span></main>") }), "E2406")).toEqual([]);
  expect(codesOf(tree({ "modules/recipes/routes.ts": routes("(p) => p.data.text.title") }), "E2406")).toEqual([]);
});
