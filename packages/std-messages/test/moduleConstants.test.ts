// The lists and patterns the rule modules hold: each test loads its module afresh, then reads through the constant.
import { expect, test, vi } from "vitest";
import { CLEAN, MODULE } from "../conformance/fixtures/support.ts";
import { expr, program, run } from "./tooling.ts";

const IMPORT = "import { messages } from '@keel/std-messages'\n";

test("copy places: each listed attribute, and text made of letters only", async () => {
  vi.resetModules();
  const { copyHits } = await import("../src/tools/internal/copyHits.ts");
  const path = "modules/recipes/View.tsx";
  const hits = (body: string) => copyHits(program(path, `export const View = () => ${body}\n`), path, []);
  for (const name of [
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
  ])
    expect(hits(`<Box ${name}="Close" />`).map((h) => h.msg)).toEqual([
      "literal copy 'Close'; read it from a message set",
    ]);
  expect(hits(`<Box id="Close" name="Close" value="Close" />`)).toEqual([]);
  expect(hits("<p>Recipes</p>")).toHaveLength(1);
  expect(hits("<p>42 %</p>")).toEqual([]);
});

test("plural forms: a template under each CLDR category is checked, and no other property", async () => {
  vi.resetModules();
  const { paramHits } = await import("../src/tools/internal/paramHits.ts");
  const params = new Map([["n", "number" as const]]);
  for (const form of ["zero", "one", "two", "few", "many", "other"])
    expect(paramHits("count", expr(`{ plural: 'n', ${form}: '{x} #' }`), params).map((h) => h.msg)).toEqual([
      "{x} is not a param of 'count'",
    ]);
  expect(paramHits("count", expr("{ plural: 'n', other: '#', plural2: '{x}', '': '{y}' }"), params)).toEqual([]);
});

test("a locale file is `<dir><Set>/<locale>.ts`, the set named as an identifier", async () => {
  vi.resetModules();
  const { localeFileOf } = await import("../src/tools/internal/localeFileOf.ts");
  const schema = (path: string, name: string) => ({
    path,
    source: `${IMPORT}export const ${name} = messages(L, {})\n`,
  });
  const project = [
    schema("modules/recipes/RecipesText.schema.ts", "RecipesText"),
    schema("RootText.schema.ts", "RootText"),
    schema("modules/recipes/$t_1.schema.ts", "$t_1"),
    schema("modules/recipes/T.schema.ts", "T"),
    schema("Set.schema.ts", "Set"),
    schema("s/Short.schema.ts", "Short"),
  ];
  const of = (path: string) => {
    const found = localeFileOf(path, project);
    return found === undefined ? undefined : [found.set.name, found.locale];
  };
  expect(of("modules/recipes/RecipesText/de-DE.ts")).toEqual(["RecipesText", "de-DE"]);
  expect(of("modules/recipes/RecipesText/x.ts")).toEqual(["RecipesText", "x"]);
  expect(of("RootText/en-US.ts")).toEqual(["RootText", "en-US"]);
  expect(of("modules/recipes/$t_1/en.ts")).toEqual(["$t_1", "en"]);
  expect(of("modules/recipes/T/en.ts")).toEqual(["T", "en"]);
  expect(of("s/Short/en.ts")).toEqual(["Short", "en"]);
  expect(of("modules/recipes/RecipesText/de-DE.tsx")).toBeUndefined();
  expect(of("modules/recipes/RecipesText/de-DE.ts.bak")).toBeUndefined();
  expect(of("modules/recipes/RecipesText/de-DE.js")).toBeUndefined();
  expect(of("modules/9Set/en.ts")).toBeUndefined();
  expect(of("modules/my-Set/en.ts")).toBeUndefined();
  expect(of("Set/sub/en.ts")).toBeUndefined();
});

test("the manifest of a module is its `module.ts`", async () => {
  vi.resetModules();
  const { dependsOn } = await import("../src/tools/internal/dependsOn.ts");
  const manifest = { path: "modules/recipes/module.ts", source: MODULE };
  expect(dependsOn("modules/recipes/View.tsx", [manifest])).toBe(true);
  expect(dependsOn("modules/recipes/View.tsx", [{ ...manifest, path: "modules/recipes/manifest.ts" }])).toBe(false);
});

test("each rule's code, spec section and explanation; E2406 skips tests, tool configs and generated trees, and reads unsafe/ files", async () => {
  vi.resetModules();
  const tools = await import("../src/tools/index.ts");
  expect(
    [
      tools.localeFile,
      tools.missingMessage,
      tools.undeclaredKey,
      tools.unusedKey,
      tools.placeholderParams,
      tools.literalCopy,
    ].map((r) => [r.code, r.see, r.explain]),
  ).toEqual([
    [
      "E2401",
      "std.messages",
      "Each locale of a message set has its file <Set>/<locale>.ts, and load is the exact dynamic import, so each locale is its own chunk. Fix: (locale) => import(`./RecipesText/${locale}.ts`).",
    ],
    [
      "E2402",
      "std.messages",
      "A locale file gives every key of its set a message. No fix: a translation cannot be derived, and another locale's text would ship the wrong language. Add the key: count: { plural: 'n', other: '# Rezepte' }.",
    ],
    [
      "E2403",
      "std.messages",
      "A locale file holds only the keys its set declares; the entry is a closed object. Fix: remove the key, or declare it in the set: messages(AppLocale, { extra: {} }, load).",
    ],
    [
      "E2404",
      "std.messages",
      "Every declared message key is read somewhere as .<key>, such as props.data.text.title. Fix: remove the key from messages(...); then remove it from each locale file (E2403).",
    ],
    [
      "E2405",
      "std.messages",
      "A template names only its key's params: {name}, plural over a number param, select over an enum param with a case per value. Fix: total: { text: 'Summe {m}' } -> { text: 'Summe {n}' }.",
    ],
    [
      "E2406",
      "std.copy",
      "Text a person reads comes from a message set in loader data, so each locale gets its own. No fix. <h1>Recipes</h1> -> <h1>{props.data.text.title}</h1>.",
    ],
  ]);

  const row = "export const row = () => Text({ children: 'Recipes' })\n";
  const copy = (path: string) => run(tools.literalCopy, { ...CLEAN, "module.ts": MODULE, [path]: row }, path).length;
  for (const path of [
    "modules/recipes/row.ts",
    "modules/recipes/latest/row.ts",
    "modules/recipes/testing.ts",
    "modules/recipes/site.config.json.ts",
    "modules/recipes/row.test.d/row.ts",
    "modules/recipes/unsafe/row.ts",
    "unsafe/row.ts",
    "row.ts",
  ])
    expect([path, copy(path)]).toEqual([path, 1]);
  for (const path of [
    "modules/recipes/test/row.ts",
    "modules/recipes/tests/row.ts",
    "modules/recipes/conformance/row.ts",
    "modules/recipes/__tests__/row.ts",
    "modules/recipes/.keel/row.ts",
    "modules/recipes/node_modules/pkg/row.ts",
    "test/row.ts",
    "modules/recipes/row.test.ts",
    "modules/recipes/row.spec.ts",
    "modules/recipes/row.config.ts",
    "modules/recipes/row.test.tsx",
    "modules/recipes/row.test.js",
    "modules/recipes/row.spec.jsx",
    "modules/recipes/row.config.mts",
    "modules/recipes/row.config.cjs",
  ])
    expect([path, copy(path)]).toEqual([path, 0]);
});
