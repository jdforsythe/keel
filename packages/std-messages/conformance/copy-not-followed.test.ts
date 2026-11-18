// Spec: std.copy, Not followed "Calls (`fmt('Recipes')`), object members (`copy.title`), `let`, destructuring, imports from installed packages, attributes and properties not listed (`id`, `name`, `type`, `href`, `value`), lowercase callees and member callees (`s.enum`, `Set.text`), and a value with no letter (`'%'`, `'42'`, `` `${a}${b}` ``)."
// Spec: std.copy, Conformance "None: `id="recipes.list"`, `type="number"`, `href="/a"`, `{props.data.text.title}`, `` {`${a}${b}`} ``, `{'%'}`, `{n + 1}`, `copy.title`, `fmt('Recipes')`, `s.enum(['a'])`, `Set.text({ title: 'Rezepte' })` in a locale file, `let t = 'x'`, a `const` from an installed package, each reporting case in a test file, and in a module whose `deps` do not list `@keel/std-messages`."
// Seed 1337 (the property below). Each negative is its own fixture: a project tree whose module lists `@keel/std-messages`
// unless the test says otherwise. The real-code cases read modules of the sample apps at test time.
import { type Dirent, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { COPY, ROUTES, ROW, SEED, VIEW, component, e2406, inView, routes } from "./fixtures/copy-support.ts";
import { MODULE } from "./fixtures/support.ts";

const word = fc.stringMatching(/^[A-Z][a-z]{2,9}$/);
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Every `.ts` and `.tsx` file under `dir` of the repository, as project files rooted at `modules/<id>`. */
function realModule(dir: string, id: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(ROOT, dir, rel), { withFileTypes: true }) as Dirent[]) {
      const next = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(e.name)) {
        out.push({ path: `modules/${id}/${next}`, source: readFileSync(join(ROOT, dir, next), "utf8") });
      }
    }
  };
  walk("");
  return out;
}

const none = (name: string, overrides: Record<string, string | null>) =>
  test(`std.copy not followed: ${name} is no E2406`, () => {
    expect(e2406(overrides).length).toBe(0);
  });
const noneIn = (name: string, body: string, head = "") =>
  test(`std.copy not followed: ${name} is no E2406`, () => {
    expect(inView(body, head).length).toBe(0);
  });

noneIn('`id="recipes.list"`', `<Box id="recipes.list" />`);
noneIn('`type="number"`', `<Input type="number" />`);
noneIn('`href="/a"`', `<Link href="/a" />`);
noneIn('`name="q"`', `<Input name="q" />`);
noneIn(
  '`value="Recipes"` and a lowercase element with `type` and `name`',
  `<form><input type="text" name="search" value="Recipes" /></form>`,
);
noneIn("`{props.data.text.title}`", "<h1>{props.data.text.title}</h1>");
noneIn(
  "`label={props.data.text.title}` and a member text in `aria-label`",
  "<Box label={props.data.text.title} aria-label={props.data.text.close} />",
);
noneIn("a template of two substitutions: `{`${a}${b}`}`", "<h1>{`${props.a}${props.b}`}</h1>");
noneIn("`{'%'}`", `<h1>{'%'}</h1>`);
noneIn("`{'42'}`", `<h1>{'42'}</h1>`);
noneIn("`{n + 1}`", "<h1>{props.n + 1}</h1>");
noneIn("a text child of punctuation and digits: `1 / 2`", "<span>1 / 2</span>");
noneIn("a template of digits and punctuation around a substitution: `${n}%`", "<span>{`${props.n}%`}</span>");
noneIn("a member of an imported object: `copy.title`", "<h1>{copy.title}</h1>", "import { copy } from './copy.ts'\n");
noneIn(
  "a member of a local object whose value is a literal: `copy.title`",
  "<h1>{copy.title}</h1>",
  "const copy = { title: 'Recipes' }\n",
);
noneIn("a call: `fmt('Recipes')` as a child", `<h1>{fmt('Recipes')}</h1>`, "import { fmt } from './fmt.ts'\n");
noneIn(
  "a call: `fmt('Search')` as an attribute",
  `<Input placeholder={fmt('Search')} />`,
  "import { fmt } from './fmt.ts'\n",
);
noneIn("a call of a member: `props.format('Recipes')`", `<h1>{props.format('Recipes')}</h1>`);
noneIn("`let t = 'x'` used in JSX", "<h1>{t}</h1>", "let t = 'Recipes'\n");
noneIn("a destructured name", "<h1>{t}</h1>", "const { t } = { t: 'Recipes' }\n");
noneIn("a `const` from an installed package", "<h1>{title}</h1>", "import { title } from 'some-installed-package'\n");
noneIn("a `const` from `@keel/ui`", "<h1>{Placeholder}</h1>", "import { Placeholder } from '@keel/ui'\n");
noneIn("a parameter and a prop", "<h1>{props.title}</h1>");
noneIn("a thunk returning a member", "<Input placeholder={() => props.data.text.search} />");
noneIn("a ternary of two member texts", "<Input label={props.ok ? props.data.text.on : props.data.text.off} />");
noneIn(
  "a literal in the `children` of a lowercase element's non-listed attribute `data-label`",
  `<p data-label="Recipes" />`,
);

none("a `const` initialized by a call and imported", {
  [COPY]: "import { fmt } from './fmt.ts'\nexport const title = fmt('Recipes')\n",
  [VIEW]: component("<h1>{title}</h1>", "import { title } from './copy.ts'\n"),
});
none("a `let` exported from `copy.ts` and imported", {
  [COPY]: "export let title = 'Recipes'\n",
  [VIEW]: component("<h1>{title}</h1>", "import { title } from './copy.ts'\n"),
});
none("a `const` whose initializer is a member: `const t = copy.title`", {
  [VIEW]: component("<h1>{t}</h1>", "import { copy } from './copy.ts'\nconst t = copy.title\n"),
});
none("a `const` in `copy.ts` that no component reads", { [COPY]: "export const title = 'Recipes'\n" });
none("a `const` holding no letter, imported", {
  [COPY]: "export const sep = ' / '\n",
  [VIEW]: component("<h1>{sep}</h1>", "import { sep } from './copy.ts'\n"),
});

none("`s.enum(['a'])` in a `.ts` file", {
  [ROW]: "import { s } from '@keel/schema'\nexport const Kind = s.enum(['alpha', 'beta'])\n",
});
none("`Set.text({ title: 'Rezepte' })` in a locale file", {
  "modules/recipes/RecipesText/de-DE.ts": `import { RecipesText } from '../RecipesText.schema.ts'\nexport default Set.text({ title: 'Rezepte', count: { plural: 'n', other: '# Rezepte' }, total: { text: 'Summe {n}' } })\n`,
});
none("`Set.text({ title: 'Rezepte' })` in a file outside the locale folder (a member callee)", {
  [ROW]: "export default Set.text({ title: 'Rezepte' })\n",
});
none("an uppercase callee in a locale file of the set: `Text({ children: 'Rezepte' })`", {
  "modules/recipes/RecipesText/de-DE.ts": "export const x = Text({ children: 'Rezepte' })\n",
});
none("a lowercase callee: `text({ children: 'Recipes' })`", {
  [ROW]: "export const x = text({ children: 'Recipes' })\n",
});
none("a member callee: `ui.Text({ children: 'Recipes' })`", {
  [ROW]: "export const x = ui.Text({ children: 'Recipes' })\n",
});
none("an uppercase callee given only unlisted properties: `Text({ id: 'recipes', type: 'row' })`", {
  [ROW]: "export const x = Text({ id: 'recipes', type: 'row', name: 'Recipes' })\n",
});
none("an uppercase callee given a spread: `Text({ ...rest })`", { [ROW]: "export const x = Text({ ...rest })\n" });
none("a listed property of an object literal that is not a call argument", {
  [ROW]: "export const x = { children: 'Recipes', title: 'Recipes' }\n",
});
none("a listed property of an object passed to a lowercase function in a `.tsx` file", {
  "modules/recipes/Row.tsx": "export const x = make({ title: 'Recipes', placeholder: 'Search' })\n",
});

none("a route `title` of a member: `(p) => p.data.text.title`", { [ROUTES]: routes("(p) => p.data.text.title") });
none("a route `title` of a call: `() => fmt('x')`", {
  [ROUTES]: routes("() => fmt('Recipes')", "import { fmt } from './fmt.ts'\n"),
});
none("a route `title` naming a same-file function that returns a member", {
  [ROUTES]: routes("pageTitle", "function pageTitle(p) { return p.data.text.title }\n"),
});
none("a route `title` returning a no-letter literal", { [ROUTES]: routes("() => '42'") });
none("a route `path` literal and a `layout` id in `routes.ts`", {
  [ROUTES]: routes("(p) => p.data.text.title").replace(
    "component: RecipeList",
    "component: RecipeList, layout: 'recipes.shell'",
  ),
});

const REPORTING: Record<string, string> = {
  "modules/recipes/RecipeList.test.tsx": component(`<Input placeholder="Search" label="Search" />`),
  "modules/recipes/row.test.ts": "export const x = Text({ children: 'Recipes' })\n",
  "modules/recipes/RecipeList.spec.tsx": component("<h1>Recipes</h1>"),
  "modules/recipes/unsafe/Row.tsx": component("<h1>Recipes</h1>"),
  "modules/recipes/.keel/Row.tsx": component("<h1>Recipes</h1>"),
};
for (const [path, source] of Object.entries(REPORTING)) {
  none(`a reporting case in ${path}`, { [path]: source });
}
test("std.copy not followed: a route `title` literal in a test file of the module is no E2406", () => {
  expect(e2406({ "modules/recipes/routes.test.ts": routes("() => 'Recipes'") }).length).toBe(0);
});

test("std.copy not followed: every reporting case is no E2406 in a module whose `deps` do not list `@keel/std-messages`", () => {
  const without = MODULE.replace("'@keel/std-messages', ", "");
  expect(without).not.toBe(MODULE);
  const cases: Record<string, string> = {
    [VIEW]: component(
      `<main><h1>Recipes</h1><Input placeholder="Search" label={ok ? 'On' : 'Off'} /><Text children="x y" />{'Hello, ' + props.name}</main>`,
    ),
    [ROW]: "export const x = Text({ children: 'Recipes' })\n",
    [ROUTES]: routes("() => 'Recipes'"),
  };
  expect(e2406({ "modules/recipes/module.ts": without, ...cases }).length).toBe(0);
});

test("std.copy not followed: a module with no `deps` at all reports no E2406", () => {
  const bare = MODULE.replace(/deps: \[[^\]]*\]/, "deps: []");
  expect(bare).not.toBe(MODULE);
  expect(e2406({ "modules/recipes/module.ts": bare, [VIEW]: component("<h1>Recipes</h1>") }).length).toBe(0);
});

test("std.copy not followed: the recipes module of golden-2, a real module listing `@keel/std-messages`, is no E2406", () => {
  const files = realModule("apps/golden-2/modules/recipes", "recipes");
  expect(files.some((f) => f.path === "modules/recipes/module.ts")).toBe(true);
  const d = check(files, { types: false }).diagnostics.filter((x) => x.code === "E2406");
  expect(d).toEqual([]);
});

test("std.copy not followed: the todos module of golden-1, whose `deps` do not list `@keel/std-messages`, is no E2406", () => {
  const files = realModule("apps/golden-1/modules/todos", "todos");
  const d = check(files, { types: false }).diagnostics.filter((x) => x.code === "E2406");
  expect(d).toEqual([]);
});

test("std.copy not followed: any word reached only through a call, a member, `let`, an unlisted attribute or a locale file is no E2406", () => {
  fc.assert(
    fc.property(word, (w) => {
      expect(inView(`<h1>{fmt('${w}')}</h1>`).length).toBe(0);
      expect(inView(`<h1>{copy.${w}}</h1>`).length).toBe(0);
      expect(inView("<h1>{t}</h1>", `let t = '${w}'\n`).length).toBe(0);
      expect(inView(`<Box id="${w}" type="${w}" href="${w}" name="${w}" />`).length).toBe(0);
      expect(
        e2406({ "modules/recipes/RecipesText/de-DE.ts": `export const x = Text({ children: '${w}' })\n` }).length,
      ).toBe(0);
      expect(e2406({ [ROW]: `export const x = text({ children: '${w}' })\n` }).length).toBe(0);
    }),
    { seed: SEED, numRuns: 40 },
  );
});
