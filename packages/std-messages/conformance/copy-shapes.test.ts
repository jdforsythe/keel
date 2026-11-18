// Spec: std.copy, Shapes "After parentheses, `as` and `satisfies`, a value in a place is copy when it is:"
// Spec: std.copy, Conformance "In a module listing `@keel/std-messages`, each one E2406 at the literal: `<Input placeholder="Search" />`, `<Box aria-label="Close" />`, `title="Info"`, each of `aria-description`, `aria-placeholder`, `aria-roledescription` and `aria-valuetext` with a word; `<Text children="Recipes" />`; `Text({ children: 'Recipes' })` in a `.ts` file of the module; `` <h1>{`${n} recipes`}</h1> ``; `{'Hello, ' + name}`; `label={ok ? 'On' : 'Off'}` (two); `placeholder={() => 'Search'}`; `const t = 'Recipes'` then `<h1>{t}</h1>`; a `const` exported from `copy.ts` and imported into the component; `RecipeRow.tsx` exporting `function RecipeRow` and no default; a route `title` returning `'Recipes: ' + name`, a template with a word, or calling a same-file function that returns `'Recipes'`."
// Seed 1337 (the properties below). Fixtures are project trees whose module lists `@keel/std-messages`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { COPY, SEED, VIEW, component, e2406, inView, lineOf } from "./fixtures/copy-support.ts";

const word = fc.stringMatching(/^[A-Z][a-z]{2,9}$/);

test("std.copy shapes: a template with substitutions whose text parts hold a letter is one E2406: `` <h1>{`${n} recipes`}</h1> ``", () => {
  expect(inView("<h1>{`${props.n} recipes`}</h1>").length).toBe(1);
  expect(inView("<h1>{`Hello, ${props.name}`}</h1>").length).toBe(1);
  expect(inView("<Input label={`${props.n} recipes`} />").length).toBe(1);
});

test("std.copy shapes: a `+` whose operands include a literal with a letter is one E2406: `{'Hello, ' + name}`", () => {
  expect(inView("<h1>{'Hello, ' + props.name}</h1>").length).toBe(1);
  expect(inView("<h1>{props.name + ' recipes'}</h1>").length).toBe(1);
});

test("std.copy shapes: `label={ok ? 'On' : 'Off'}` is two E2406, one per branch", () => {
  const d = inView("<Input label={props.ok ? 'On' : 'Off'} />");
  expect(d.length).toBe(2);
  expect(new Set(d.map((x) => x.col)).size).toBe(2);
});

test("std.copy shapes: one literal branch of `?:` with the other branch not copy is one E2406", () => {
  expect(inView("<Input label={props.ok ? 'On' : props.data.text.off} />").length).toBe(1);
  expect(inView("<Input label={props.ok ? props.data.text.on : 'Off'} />").length).toBe(1);
  expect(inView("<Input label={props.ok ? props.data.text.on : props.data.text.off} />").length).toBe(0);
});

test("std.copy shapes: either side of `||` or `??`, and the right of `&&`, is copy", () => {
  expect(inView("<h1>{props.title || 'Untitled'}</h1>").length).toBe(1);
  expect(inView("<h1>{'Untitled' || props.title}</h1>").length).toBe(1);
  expect(inView("<h1>{props.title ?? 'Untitled'}</h1>").length).toBe(1);
  expect(inView("<h1>{'Untitled' ?? props.title}</h1>").length).toBe(1);
  expect(inView("<h1>{props.ok && 'Saved'}</h1>").length).toBe(1);
});

test("std.copy shapes: the left of `&&` is a condition, not copy", () => {
  expect(inView("<h1>{'Saved' && props.data.text.title}</h1>").length).toBe(0);
});

test("std.copy shapes: the body of a thunk is copy: `placeholder={() => 'Search'}` is one E2406", () => {
  expect(inView("<Input placeholder={() => 'Search'} />").length).toBe(1);
  expect(inView("<Input placeholder={() => `${props.n} found`} />").length).toBe(1);
  expect(inView("<Input placeholder={() => props.data.text.search} />").length).toBe(0);
});

test("std.copy shapes: parentheses, `as` and `satisfies` around a value are looked through", () => {
  expect(inView("<h1>{('Recipes')}</h1>").length).toBe(1);
  expect(inView("<h1>{'Recipes' as string}</h1>").length).toBe(1);
  expect(inView("<h1>{'Recipes' satisfies string}</h1>").length).toBe(1);
  expect(inView("<Input label={(('Recipes') as string)} />").length).toBe(1);
});

test("std.copy shapes: `const t = 'Recipes'` then `<h1>{t}</h1>` is one E2406 at the use, not at the declaration", () => {
  const head = "const t = 'Recipes'\n";
  const d = inView("<h1>{t}</h1>", head);
  expect(d.length).toBe(1);
  expect(d[0]?.line).toBe(lineOf(component("<h1>{t}</h1>", head), "<h1>{t}</h1>"));
  expect(d[0]?.line).not.toBe(1);
});

test("std.copy shapes: the same `const` used twice is two E2406, one at each use", () => {
  const body = "<main><h1>{t}</h1><p>{t}</p></main>";
  expect(inView(body, "const t = 'Recipes'\n").length).toBe(2);
});

test("std.copy shapes: a `const` used as an attribute value or in a thunk is reported at the use", () => {
  const head = "const t = 'Search'\n";
  expect(inView("<Input placeholder={t} />", head).length).toBe(1);
  expect(inView("<Input placeholder={() => t} />", head).length).toBe(1);
  expect(inView("<Input label={props.ok ? t : props.data.text.x} />", head).length).toBe(1);
});

test("std.copy shapes: a `const` whose initializer is a template with a word or a `+` with a word literal is copy", () => {
  expect(inView("<h1>{t}</h1>", "const t = `Hello, ${'x'}`\n").length).toBe(1);
  expect(inView("<h1>{t}</h1>", "const t = 'Hello, ' + 'there'\n").length).toBe(1);
});

test("std.copy shapes: a `const` exported from `copy.ts` and imported into the component is one E2406 at the use", () => {
  const head = "import { title } from './copy.ts'\n";
  const d = e2406({ [COPY]: "export const title = 'Recipes'\n", [VIEW]: component("<h1>{title}</h1>", head) });
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(VIEW);
  expect(d[0]?.line).toBe(lineOf(component("<h1>{title}</h1>", head), "<h1>{title}"));
});

test("std.copy shapes: an imported `const` used twice is two E2406, none at the declaration in `copy.ts`", () => {
  const head = "import { title } from './copy.ts'\n";
  const d = e2406({
    [COPY]: "export const title = 'Recipes'\n",
    [VIEW]: component("<main><h1>{title}</h1><p>{title}</p></main>", head),
  });
  expect(d.length).toBe(2);
  expect(d.every((x) => x.path === VIEW)).toBe(true);
});

test("std.copy files: `RecipeRow.tsx` exporting `function RecipeRow` and no default is read: one E2406", () => {
  const src = "export function RecipeRow() {\n  return <p>Hello there</p>\n}\n";
  const d = e2406({ "modules/recipes/RecipeRow.tsx": src });
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("modules/recipes/RecipeRow.tsx");
});

test("std.copy files: a `.tsx` file is read whatever its name and folder", () => {
  const src = 'export const Row = () => <Input label="Search" />\n';
  for (const path of [
    "modules/recipes/row.tsx",
    "modules/recipes/RECIPE.tsx",
    "modules/recipes/ui/deep/Cell.tsx",
    "modules/recipes/index.tsx",
  ]) {
    expect(e2406({ [path]: src }).length).toBe(1);
  }
});

test("std.copy files: an unexported component and a file with only named exports are read", () => {
  expect(e2406({ "modules/recipes/Row.tsx": "const Row = () => <p>Hello there</p>\nexport { Row }\n" }).length).toBe(1);
  expect(
    e2406({ "modules/recipes/Row.tsx": "function Row() { return <p>Hello there</p> }\nexport const x = Row\n" }).length,
  ).toBe(1);
});

test("std.copy shapes: copy of any word in any shape is one E2406 per literal; a template or `+` of no-letter parts is none", () => {
  fc.assert(
    fc.property(word, (w) => {
      const shapes = [
        `<h1>{'${w}'}</h1>`,
        `<h1>{\`\${props.n} ${w}\`}</h1>`,
        `<h1>{'${w}, ' + props.name}</h1>`,
        `<h1>{props.name + ' ${w}'}</h1>`,
        `<h1>{props.t || '${w}'}</h1>`,
        `<h1>{props.t ?? '${w}'}</h1>`,
        `<h1>{props.ok && '${w}'}</h1>`,
        `<Input placeholder={() => '${w}'} />`,
        `<Input label={('${w}')} />`,
      ];
      for (const s of shapes) expect(inView(s).length).toBe(1);
      expect(inView(`<Input label={props.ok ? '${w}' : '${w}x'} />`).length).toBe(2);
      expect(inView("<h1>{t}</h1>", `const t = '${w}'\n`).length).toBe(1);
      expect(inView("<h1>{`${props.a}${props.b}`}</h1>").length).toBe(0);
      expect(inView("<h1>{'12' + props.n}</h1>").length).toBe(0);
    }),
    { seed: SEED, numRuns: 40 },
  );
});
