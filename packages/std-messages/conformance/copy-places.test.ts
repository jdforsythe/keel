// std.copy, Files "Every app `*.tsx` file of the module, with or without `export default` and whatever its name, and its `routes.ts` (the route `title` only). Calls (below) are read in every app file of the module except the set's locale files. Tests and `.keel/` are not read; a file under `unsafe/` is read whole, its `unsafe(` calls included (k.check App code)."
// std.copy, Places "A JSX text child; a JSX child expression; a JSX attribute `label`, `alt`, `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` or `children`; the same names as properties of an object literal passed to a call whose callee is an identifier starting with an uppercase letter (`Text({ children: 'Recipes' })`, `Input({ placeholder: 'Search' })`); and what a route `title` returns, from any `return` of its function or a same-file function it names."
// Spec: std.copy, clause "In a module listing `@keel/std-messages`, each one E2406 at the literal: `<Input placeholder=\"Search\" />`, `<Box aria-label=\"Close\" />`, `title=\"Info\"`, each of `aria-description`, `aria-placeholder`, `aria-roledescription` and `aria-valuetext` with a word; `<Text children=\"Recipes\" />`; `Text({ children: 'Recipes' })` in a `.ts` file of the module; `` <h1>{`${n} recipes`}</h1> ``; `{'Hello, ' + name}`; `label={ok ? 'On' : 'Off'}` (two); `placeholder={() => 'Search'}`; `const t = 'Recipes'` then `<h1>{t}</h1>`; a `const` exported from `copy.ts` and imported into the component; `RecipeRow.tsx` exporting `function RecipeRow` and no default; a route `title` returning `'Recipes: ' + name`, a template with a word, or calling a same-file function that returns `'Recipes'`."
// Seed 1337 (the property below). Fixtures are project trees whose module lists `@keel/std-messages`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { ROUTES, ROW, SEED, VIEW, component, e2406, inView, lineOf, routes } from "./fixtures/copy-support.ts";

const word = fc.stringMatching(/^[A-Z][a-z]{2,9}$/);

test('std.copy places: `<Input placeholder="Search" />`, `<Box aria-label="Close" />` and `title="Info"` are each one E2406 at the literal, with no fix', () => {
  for (const [jsx, needle] of [
    [`<Input placeholder="Search" />`, "Search"],
    [`<Box aria-label="Close" />`, "Close"],
    [`<Box title="Info" />`, "Info"],
  ] as const) {
    const d = inView(jsx);
    expect(d.length).toBe(1);
    expect(d[0]?.path).toBe(VIEW);
    expect(d[0]?.line).toBe(lineOf(component(jsx), needle));
    expect(d[0]?.fix).toBeUndefined();
  }
});

test("std.copy places: each of `aria-description`, `aria-placeholder`, `aria-roledescription` and `aria-valuetext` with a word is one E2406", () => {
  for (const attr of ["aria-description", "aria-placeholder", "aria-roledescription", "aria-valuetext"]) {
    expect(inView(`<Box ${attr}="Hello there" />`).length).toBe(1);
    expect(inView(`<Box ${attr}={'Hello there'} />`).length).toBe(1);
  }
});

test("std.copy places: `label` and `alt` with a word are each one E2406", () => {
  expect(inView(`<Input label="Search" />`).length).toBe(1);
  expect(inView(`<Image alt="A pie" />`).length).toBe(1);
});

test('std.copy places: `<Text children="Recipes" />` is one E2406', () => {
  expect(inView(`<Text children="Recipes" />`).length).toBe(1);
  expect(inView(`<Text children={'Recipes'} />`).length).toBe(1);
});

test("std.copy places: a JSX text child and a literal JSX child expression with a letter are each one E2406", () => {
  expect(inView("<main><h1>Recipes</h1></main>").length).toBe(1);
  expect(inView(`<main><h1>{'Recipes'}</h1></main>`).length).toBe(1);
  expect(inView("<main><h1>{`Recipes`}</h1></main>").length).toBe(1);
});

test("std.copy places: any word in any listed attribute or text child is one E2406; the same word with no letter is none", () => {
  const attrs = [
    "label",
    "alt",
    "placeholder",
    "title",
    "aria-label",
    "aria-description",
    "aria-placeholder",
    "aria-roledescription",
    "aria-valuetext",
    "children",
  ];
  fc.assert(
    fc.property(fc.constantFrom(...attrs), word, fc.stringMatching(/^[0-9%+.,:;/ -]{1,6}$/), (attr, w, noLetters) => {
      expect(inView(`<Box ${attr}="${w}" />`).length).toBe(1);
      expect(inView(`<Box ${attr}="${noLetters}" />`).length).toBe(0);
    }),
    { seed: SEED, numRuns: 60 },
  );
});

test("std.copy places: any attribute not listed holds a token or data and is none, whatever the word", () => {
  const others = ["id", "name", "type", "href", "value", "className", "role", "lang", "src", "data-testid", "for"];
  fc.assert(
    fc.property(fc.constantFrom(...others), word, (attr, w) => {
      expect(inView(`<Box ${attr}="${w}" />`).length).toBe(0);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("std.copy places: `Text({ children: 'Recipes' })` in a `.ts` file of the module is one E2406", () => {
  const d = e2406({ [ROW]: `export const row = Text({ children: 'Recipes' })\n` });
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(ROW);
  expect(d[0]?.line).toBe(1);
});

test("std.copy places: `Input({ placeholder: 'Search' })` in a `.ts` file of the module is one E2406", () => {
  expect(e2406({ [ROW]: `export const row = Input({ placeholder: 'Search' })\n` }).length).toBe(1);
});

test("std.copy places: every listed name as a property of an object literal passed to an uppercase callee is one E2406, in a `.ts` and a `.tsx` file", () => {
  for (const name of ["label", "alt", "placeholder", "title", "aria-label", "aria-description", "children"]) {
    const key = name.includes("-") ? `'${name}'` : name;
    expect(e2406({ [ROW]: `export const row = Box({ ${key}: 'Hello there' })\n` }).length).toBe(1);
    expect(e2406({ "modules/recipes/ui/Row.tsx": `export const row = Box({ ${key}: 'Hello there' })\n` }).length).toBe(
      1,
    );
  }
});

test("std.copy places: a `.ts` file of any name in a subfolder of the module is read for calls", () => {
  expect(e2406({ "modules/recipes/ui/deep/make.ts": `export const x = Text({ children: 'Recipes' })\n` }).length).toBe(
    1,
  );
});

test("std.copy places: a route `title` returning `'Recipes: ' + name` is one E2406", () => {
  const d = e2406({ [ROUTES]: routes(`(p) => 'Recipes: ' + p.params.name`) });
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(ROUTES);
});

test("std.copy places: a route `title` returning a template with a word is one E2406", () => {
  expect(e2406({ [ROUTES]: routes("(p) => `Recipes of ${p.params.name}`") }).length).toBe(1);
});

test("std.copy places: a route `title` returning a string literal is one E2406", () => {
  expect(e2406({ [ROUTES]: routes(`() => 'Recipes'`) }).length).toBe(1);
});

test("std.copy places: a route `title` is read from any `return` of its function, the second of a block body included", () => {
  const title = `(p) => {\n      if (p.params.name === undefined) return p.data.text.title\n      return 'Recipes: ' + p.params.name\n    }`;
  const d = e2406({ [ROUTES]: routes(title) });
  expect(d.length).toBe(1);
  expect(d[0]?.line).toBe(lineOf(routes(title), "return 'Recipes: '"));
});

test("std.copy places: a route `title` that calls a same-file function returning `'Recipes'` is one E2406", () => {
  const head = `function pageTitle() { return 'Recipes' }\n`;
  expect(e2406({ [ROUTES]: routes("() => pageTitle()", head) }).length).toBe(1);
});

test("std.copy places: a route `title` that names a same-file function returning `'Recipes'` is one E2406", () => {
  const head = `function pageTitle() { return 'Recipes' }\n`;
  expect(e2406({ [ROUTES]: routes("pageTitle", head) }).length).toBe(1);
});
