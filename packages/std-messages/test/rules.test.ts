import "@keel/std-messages/tools";
import { expect, test } from "vitest";
import { CLEAN, MODULE, applyFix, codesOf, tree } from "./support.ts";

const SET = "modules/recipes/RecipesText.schema.ts";
const DE = "modules/recipes/RecipesText/de-DE.ts";
const de = (entry: string) =>
  `import { RecipesText } from '../RecipesText.schema.ts'\nexport default RecipesText.text(${entry})\n`;
const setWith = (load: string) => (CLEAN[SET] ?? "").replace(/\(locale\) => import\(.*\)\)$/m, `${load})`);

test("E2401: a missing locale file, and a load that is not the exact import, with a fix for the load", () => {
  expect(codesOf(tree(), "E2401")).toEqual([]);
  const missing = codesOf(tree({ [DE]: null }), "E2401");
  expect(missing.map((d) => [d.path, d.message])).toEqual([
    [SET, "locale 'de-DE' of RecipesText has no file RecipesText/de-DE.ts"],
  ]);
  for (const load of ["(locale) => import('./RecipesText/en-US.ts')", "async (l) => import(`./RecipesText/${l}.ts`)"]) {
    const files = tree({ [SET]: setWith(load) });
    const [d] = codesOf(files, "E2401");
    expect(d?.fix).toBeTypeOf("string");
    expect(codesOf(applyFix(files, d?.fix ?? ""), "E2401")).toEqual([]);
  }
  expect(codesOf(tree({ [SET]: setWith("(lang) => import(`./RecipesText/${lang}.ts`)") }), "E2401")).toEqual([]);
});

test("rules run only in a module whose deps list @keel/std-messages", () => {
  const without = MODULE.replace("'@keel/std-messages', ", "");
  const files = tree({ "modules/recipes/module.ts": without, [DE]: null });
  for (const code of ["E2401", "E2404", "E2406"]) expect(codesOf(files, code)).toEqual([]);
  const view = "export default function RecipeList() {\n  return <h1>Recipes</h1>\n}\n";
  expect(
    codesOf(tree({ "modules/recipes/module.ts": without, "modules/recipes/RecipeList.tsx": view }), "E2406"),
  ).toEqual([]);
});

test("E2405: select cases must match the enum's values; a stray brace is reported without a fix", () => {
  const set = (CLEAN[SET] ?? "").replace("total: { n: s.int() }", "total: { k: s.enum(['a', 'b']) }");
  const files = (total: string) =>
    tree({
      [SET]: set,
      "modules/recipes/RecipesText/en-US.ts": de(`{ title: 'R', count: { plural: 'n', other: '#' }, total: ${total} }`),
      [DE]: de(`{ title: 'R', count: { plural: 'n', other: '#' }, total: ${total} }`),
    });
  expect(codesOf(files("{ select: 'k', cases: { a: 'A', b: 'B' } }"), "E2405")).toEqual([]);
  const missing = codesOf(files("{ select: 'k', cases: { a: 'A' } }"), "E2405");
  expect(missing.map((d) => d.message)).toEqual([
    "select of 'total' lacks case 'b'",
    "select of 'total' lacks case 'b'",
  ]);
  expect(codesOf(files("{ select: 'k', cases: { a: 'A', b: 'B', c: 'C' } }"), "E2405")).toHaveLength(2);
  const brace = codesOf(
    tree({ [DE]: de("{ title: 'a{b', count: { plural: 'n', other: '#' }, total: { text: '{n}' } }") }),
    "E2405",
  );
  expect(brace).toHaveLength(1);
  expect(brace[0]?.fix).toBeUndefined();
});

test("E2403 removes the last key with its comma; E2404 names each unread key", () => {
  const extra = de("{ title: 'R', count: { plural: 'n', other: '#' }, total: { text: '{n}' }, extra: 'x', }");
  const [d] = codesOf(tree({ [DE]: extra }), "E2403");
  const fixed = applyFix(tree({ [DE]: extra }), d?.fix ?? "").find((f) => f.path === DE)?.source;
  expect(fixed).toContain("total: { text: '{n}' }, }");
  const view = "export default function RecipeList(props) {\n  return <main>{props.data.text.count}</main>\n}\n";
  const unread = codesOf(tree({ "modules/recipes/RecipeList.tsx": view }), "E2404").map((x) => x.message);
  expect(unread).toEqual([
    "message key 'title' of RecipesText is never read",
    "message key 'total' of RecipesText is never read",
  ]);
});

test("E2406: a route title's block-body return; expressions and letterless text are not copy", () => {
  const routes = (title: string) =>
    `import { manifest } from '@keel/router'\nimport RecipeList from './RecipeList.tsx'\nexport const routes = manifest({ 'recipes.list': { path: '/:locale/recipes', component: RecipeList, title: ${title} } })\n`;
  const at = (title: string) => codesOf(tree({ "modules/recipes/routes.ts": routes(title) }), "E2406");
  expect(at("function () { if (1) { return `Recipes` } return 'x' }")).toHaveLength(2);
  expect(at("(p) => { const f = () => 'inner'; return p.data.text.title }")).toEqual([]);
  const view = (body: string) =>
    `export default function RecipeList(props) {\n  const t = props.data.text\n  return ${body}\n}\n`;
  const v = (body: string) => codesOf(tree({ "modules/recipes/RecipeList.tsx": view(body) }), "E2406");
  expect(v("<main><Image alt={t.title} /><p>{t.title} {t.count} {t.total} - 42 %</p></main>")).toEqual([]);
  expect(v("<main><Image alt={`A pie`} /><p>{t.title}{t.count}{t.total}</p></main>")).toHaveLength(1);
});

test("E2407: one patch clears every never-selected form of a message, with the zero rename and the removals together", () => {
  const entry = (count: string) => de(`{ title: 'T', count: ${count}, total: { text: 'Total {n}' } }`);
  const en = "modules/recipes/RecipesText/en-US.ts";
  const files = tree({
    [en]: entry("{ plural: 'n', zero: 'none', one: '# a', two: '# t', few: '# f', other: '# b' }"),
  });
  const found = codesOf(files, "E2407");
  expect(found.map((d) => d.message)).toEqual([
    "plural form zero never applies in en-US; '=0' matches 0",
    "plural form two never applies in en-US",
    "plural form few never applies in en-US",
  ]);
  const out = applyFix(files, found[0]?.fix ?? "").find((f) => f.path === en)?.source ?? "";
  expect(out).toContain("{ plural: 'n', '=0': 'none', one: '# a', other: '# b' }");
  expect(codesOf(applyFix(files, found[0]?.fix ?? ""), "E2407")).toEqual([]);
});
