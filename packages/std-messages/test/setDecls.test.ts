// What the rules read from a module: its manifest's deps, the sets a schema file declares, a set's locales and a
// locale file's entry.
import { describe, expect, it } from "vitest";
import { dependsOn } from "../src/tools/internal/dependsOn.ts";
import { entryOf } from "../src/tools/internal/entryOf.ts";
import { localeFileOf } from "../src/tools/internal/localeFileOf.ts";
import { localesOf } from "../src/tools/internal/localesOf.ts";
import { setDecls } from "../src/tools/internal/setDecls.ts";
import { at, program } from "./tooling.ts";

const IMPORT = "import { messages } from '@keel/std-messages'\n";
const EXACT = "(locale) => import(`./RecipesText/${locale}.ts`)";
const decls = (source: string) => setDecls(program("modules/recipes/RecipesText.schema.ts", source));
/** The `load` of `export const RecipesText = messages(AppLocale, { title: {} }, <load>)`. */
const loadOf = (load: string) =>
  decls(`${IMPORT}export const RecipesText = messages(AppLocale, { title: {} }, ${load})\n`)[0]?.load;

describe("setDecls", () => {
  it("reads a declaration: name, call offset, locales name, every property span, keys with params, load", () => {
    const keys =
      "{ title: {}, count: { n: s.int({ min: 0 }), unit: s.enum(['g', 'kg']) }, 'by-line': { who: line() } }";
    const source = `import { s } from '@keel/schema'\n${IMPORT}export const RecipesText = messages(AppLocale, ${keys}, ${EXACT})\n`;
    const span = (text: string) => ({ start: at(source, text), end: at(source, text) + text.length });
    const items = [
      span("title: {}"),
      span("count: { n: s.int({ min: 0 }), unit: s.enum(['g', 'kg']) }"),
      span("'by-line': { who: line() }"),
    ];
    expect(decls(source)).toEqual([
      {
        name: "RecipesText",
        at: at(source, "messages(AppLocale"),
        locales: "AppLocale",
        items,
        keys: [
          { name: "title", index: 0, params: new Map(), ...items[0] },
          {
            name: "count",
            index: 1,
            params: new Map<string, unknown>([
              ["n", "number"],
              ["unit", ["g", "kg"]],
            ]),
            ...items[1],
          },
          { name: "by-line", index: 2, params: new Map([["who", "string"]]), ...items[2] },
        ],
        load: { ...span(EXACT), exact: true },
        after: at(source, keys) + keys.length,
      },
    ]);
  });

  it("reads each set of a file, exported or not, in order, and once per program", () => {
    const source = `${IMPORT}const A = messages(L, { a: {} })\nexport const B = messages(L, { b: {} }), C = messages(L, {})\n`;
    expect(decls(source).map((d) => [d.name, d.keys.map((k) => k.name)])).toEqual([
      ["A", ["a"]],
      ["B", ["b"]],
      ["C", []],
    ]);
    const p = program("a.schema.ts", source);
    expect(setDecls(p)).toBe(setDecls(p));
  });

  it("follows the local name `messages` is imported under", () => {
    expect(decls("import { messages as declare } from '@keel/std-messages'\nconst A = declare(L, {})\n")).toHaveLength(
      1,
    );
    expect(
      decls("import { 'messages' as declare } from '@keel/std-messages'\nconst A = declare(L, {})\n"),
    ).toHaveLength(1);
    expect(
      decls("import { messages, formatMessage } from '@keel/std-messages'\nconst A = messages(L, {})\n"),
    ).toHaveLength(1);
    expect(
      decls("import { formatMessage, messages } from '@keel/std-messages'\nconst A = messages(L, {})\n"),
    ).toHaveLength(1);
    expect(decls("import { messages as declare } from '@keel/std-messages'\nconst A = messages(L, {})\n")).toEqual([]);
    expect(decls("import { formatMessage } from '@keel/std-messages'\nconst A = formatMessage(L, {})\n")).toEqual([]);
  });

  it("reads no set when `messages` comes from elsewhere or is not a named import", () => {
    expect(decls("const A = messages(L, {})\n")).toEqual([]);
    expect(decls("const first = 1\nimport { messages } from './messages.ts'\nconst A = messages(L, {})\n")).toEqual([]);
    expect(decls("import { messages } from '@keel/std-i18n'\nconst A = messages(L, {})\n")).toEqual([]);
    expect(decls("import * as m from '@keel/std-messages'\nconst A = m.messages(L, {})\n")).toEqual([]);
    expect(decls("import messages from '@keel/std-messages'\nconst A = messages(L, {})\n")).toEqual([]);
  });

  it("reads only `<name> = messages(<locales>, { ... })` declarations", () => {
    const others = [
      "export const five = 5",
      "export const other = declare(L, { a: {} })",
      "export const viaMember = lib.messages(L, { a: {} })",
      "export const noArgs = messages()",
      "export const spreadArgs = messages(...args)",
      "export const spreadKeys = messages(L, ...rest)",
      "export const namedKeys = messages(L, keys)",
      "export const { a } = messages(L, { a: {} })",
      "export let later",
      "let unset",
      "export { five as cinq }",
      "export function f() { return messages(L, { a: {} }) }",
      "messages(L, { a: {} })",
    ];
    expect(decls(`${IMPORT}${others.join("\n")}\n`)).toEqual([]);
    expect(decls(`${IMPORT}${others.join("\n")}\nexport const Real = messages(L, {})\n`).map((d) => d.name)).toEqual([
      "Real",
    ]);
  });

  it("keeps a span for every property, and a key for each named one whose value is an object literal", () => {
    const source = `${IMPORT}const A = messages(L, { ...base, title: {}, [k]: {}, label: 'x', count: { ...shared, [p]: s.int(), n: s.int() } } as const)\n`;
    const [d] = decls(source);
    expect(d?.items).toHaveLength(5);
    expect(d?.keys.map((k) => [k.name, k.index, [...k.params]])).toEqual([
      ["title", 1, []],
      ["count", 4, [["n", "number"]]],
    ]);
    expect(d?.keys[0]?.start).toBe(at(source, "title: {}"));
    expect(d?.items[1]).toEqual({ start: at(source, "title: {}"), end: at(source, "title: {}") + "title: {}".length });
  });

  it("names the locales argument only when it is an identifier", () => {
    const of = (locales: string) => decls(`${IMPORT}const A = messages(${locales}, { a: {} })\n`)[0];
    expect(of("AppLocale")?.locales).toBe("AppLocale");
    expect(of("(AppLocale as never)")?.locales).toBe("AppLocale");
    expect(of("s.enum(['en-US'])")?.locales).toBeUndefined();
    expect(of("...spread")?.locales).toBeUndefined();
    expect(of("...spread")?.keys.map((k) => k.name)).toEqual(["a"]);
  });

  it("has no load when the third argument is absent or a spread", () => {
    const source = `${IMPORT}const A = messages(L, { a: {} })\n`;
    expect(decls(source)[0]?.load).toBeUndefined();
    expect(decls(source)[0]?.after).toBe(at(source, "{ a: {} }") + "{ a: {} }".length);
    expect(decls(`${IMPORT}const A = messages(L, { a: {} }, ...rest)\n`)[0]?.load).toBeUndefined();
  });

  it("takes as exact only the one-param arrow importing `./<Set>/${param}.ts`", () => {
    expect(loadOf(EXACT)?.exact).toBe(true);
    expect(loadOf("(l) => import(`./RecipesText/${l}.ts`)")?.exact).toBe(true);
    expect(loadOf("((l) => (import(`./RecipesText/${l}.ts`)))")?.exact).toBe(true);
  });

  it.each([
    ["a named function", "loadLocale"],
    ["a function expression", "function (l) { return import(`./RecipesText/${l}.ts`) }"],
    ["an async arrow", "async (l) => import(`./RecipesText/${l}.ts`)"],
    ["an arrow of two params", "(l, m) => import(`./RecipesText/${l}.ts`)"],
    ["an arrow of no param", "() => import(`./RecipesText/${l}.ts`)"],
    ["a destructured param", "({ l }) => import(`./RecipesText/${l}.ts`)"],
    ["a block body", "(l) => { return import(`./RecipesText/${l}.ts`) }"],
    ["a call that is not an import", "(l) => loaders(`./RecipesText/${l}.ts`)"],
    ["a lookup", "(l) => loaders[l]"],
    ["an import with options", "(l) => import(`./RecipesText/${l}.ts`, { with: { type: 'json' } })"],
    ["a literal path", "(l) => import('./RecipesText/en-US.ts')"],
    ["a template without the param", "(l) => import(`./RecipesText/en-US.ts`)"],
    ["another directory", "(l) => import(`./Other/${l}.ts`)"],
    ["a parent directory", "(l) => import(`../RecipesText/${l}.ts`)"],
    ["another extension", "(l) => import(`./RecipesText/${l}.js`)"],
    ["no extension", "(l) => import(`./RecipesText/${l}`)"],
    ["a member of the param", "(l) => import(`./RecipesText/${l.tag}.ts`)"],
    ["another name than the param", "(l) => import(`./RecipesText/${m}.ts`)"],
    ["a second substitution", "(l) => import(`./RecipesText/${l}.ts${l}`)"],
    ["a doubled substitution", "(l) => import(`./RecipesText/${l}${l}.ts`)"],
  ])("load as %s is not exact", (_, load) => {
    const got = loadOf(load);
    expect(got?.exact).toBe(false);
    expect(got?.end).toBe((got?.start ?? 0) + load.length);
  });
});

describe("entryOf", () => {
  const entry = (source: string) => entryOf(program("modules/recipes/RecipesText/de-DE.ts", source), "RecipesText");

  it("reads the default-exported `<Set>.text({ ... })`: the object and each keyed property with its index", () => {
    const source =
      "import { RecipesText } from '../RecipesText.schema.ts'\nexport const x = 1\nexport default RecipesText.text({ ...base, title: 'R', [k]: 'x', 'count': { text: 'c' } })\n";
    const e = entry(source);
    expect(e?.obj.start).toBe(at(source, "{ ...base"));
    expect(e?.obj.properties).toHaveLength(4);
    expect(e?.props.map((p) => [p.name, p.index, p.prop.start])).toEqual([
      ["title", 1, at(source, "title:")],
      ["count", 3, at(source, "'count'")],
    ]);
    expect(entry("export default (RecipesText.text({}) satisfies unknown)\n")?.props).toEqual([]);
  });

  it.each([
    ["no default export", "export const x = RecipesText.text({ a: 'x' })"],
    ["a default function", "export default function text() { return RecipesText.text({ a: 'x' }) }"],
    ["a default class", "export default class RecipesText {}"],
    ["a default value", "export default 5"],
    ["a default object", "export default { a: 'x' }"],
    ["a bare call", "export default text({ a: 'x' })"],
    ["a computed method", "export default RecipesText[text]({ a: 'x' })"],
    ["a string-keyed method", "export default RecipesText['text']({ a: 'x' })"],
    ["another set", "export default OtherText.text({ a: 'x' })"],
    ["a set reached through a member", "export default sets.RecipesText.text({ a: 'x' })"],
    ["another method", "export default RecipesText.parse({ a: 'x' })"],
    ["no argument", "export default RecipesText.text()"],
    ["a spread argument", "export default RecipesText.text(...entries)"],
    ["a named entry", "export default RecipesText.text(entry)"],
  ])("has no entry for %s", (_, source) => {
    expect(entry(`${source}\n`)).toBeUndefined();
  });
});

describe("localesOf", () => {
  const FILE = { path: "modules/recipes/RecipesText.schema.ts", source: "" };
  const LOCALES = {
    path: "modules/recipes/AppLocale.schema.ts",
    source: "export const Other = s.enum(['fr-FR'])\nexport const AppLocale = s.enum(['en-US', 'de-DE'])\n",
  };
  const of = (source: string, project = [LOCALES]) => localesOf("AppLocale", FILE, program(FILE.path, source), project);

  it("reads an enum declared in the schema file, exported or not", () => {
    expect(of("const before = s.enum(['x'])\nconst AppLocale = s.enum(['en-US', 'ja-JP'])\n")).toEqual([
      "en-US",
      "ja-JP",
    ]);
    expect(of("export const { a } = b, other = s.enum(['x']), AppLocale = s.enum(['en-US'])\n")).toEqual(["en-US"]);
    expect(of("export { x }\nexport const AppLocale = s.enum(['en-US'])\n")).toEqual(["en-US"]);
  });

  it("reads none from a same-file name that is not an enum of literals", () => {
    expect(of("const AppLocale = s.string()\n")).toBeUndefined();
    expect(of("const AppLocale = s.enum(tags)\n")).toBeUndefined();
    expect(of("let AppLocale\n")).toBeUndefined();
  });

  it("follows a named import from a relative module, under its imported name", () => {
    expect(of("const first = 1\nimport { Other, AppLocale } from './AppLocale.schema.ts'\n")).toEqual([
      "en-US",
      "de-DE",
    ]);
    expect(of("import { Other as AppLocale } from './AppLocale.schema.ts'\n")).toEqual(["fr-FR"]);
    expect(of("import { AppLocale } from '../recipes/./AppLocale.schema.ts'\n")).toEqual(["en-US", "de-DE"]);
  });

  it("reads none through a default import, a package, a missing or broken file, or another name", () => {
    expect(of("import AppLocale from './AppLocale.schema.ts'\n")).toBeUndefined();
    expect(of("import { AppLocale } from '@app/locales'\n")).toBeUndefined();
    expect(of("import { AppLocale } from './AppLocale.schema.ts'\n", [])).toBeUndefined();
    expect(
      of("import { AppLocale } from './AppLocale.schema.ts'\n", [{ path: LOCALES.path, source: "export const = \n" }]),
    ).toBeUndefined();
    expect(of("import { Other } from './AppLocale.schema.ts'\n")).toBeUndefined();
    expect(of("import { Missing as AppLocale } from './AppLocale.schema.ts'\n")).toBeUndefined();
    expect(of("")).toBeUndefined();
  });
});

describe("localeFileOf", () => {
  const schema = (path: string, ...names: string[]) => ({
    path,
    source: `${IMPORT}${names.map((n) => `export const ${n} = messages(L, {})\n`).join("")}`,
  });

  it("names the set and locale of `<dir><Set>/<locale>.ts`, by the set's name among the file's sets", () => {
    const project = [schema("modules/recipes/RecipesText.schema.ts", "Other", "RecipesText")];
    const got = localeFileOf("modules/recipes/RecipesText/de-DE.ts", project);
    expect(got?.locale).toBe("de-DE");
    expect(got?.set.name).toBe("RecipesText");
  });

  it("is nothing without a schema file declaring that set beside the directory", () => {
    const project = [schema("modules/recipes/RecipesText.schema.ts", "Other")];
    expect(localeFileOf("modules/recipes/RecipesText/de-DE.ts", project)).toBeUndefined();
    expect(localeFileOf("modules/recipes/Missing/de-DE.ts", project)).toBeUndefined();
    expect(localeFileOf("de-DE.ts", project)).toBeUndefined();
    const broken = [{ path: "modules/recipes/RecipesText.schema.ts", source: "export const = \n" }];
    expect(localeFileOf("modules/recipes/RecipesText/de-DE.ts", broken)).toBeUndefined();
  });
});

describe("dependsOn", () => {
  const PKG = "'@keel/std-messages'";
  const manifest = (source: string, path = "modules/recipes/module.ts") => ({ path, source: `${source}\n` });
  const listed = (source: string) => dependsOn("modules/recipes/View.tsx", [manifest(source)]);

  it.each([
    ["a `module` call", `export default module({ id: 'recipes', deps: ['@keel/ui', ${PKG}] })`],
    ["a plain object", `export default { id: 'recipes', deps: [${PKG}] }`],
    ["a wrapped object", `export default ({ deps: [${PKG}] } satisfies Manifest)`],
    ["a string key", `export default module({ 'deps': [${PKG}] } as const)`],
    ["a list with other elements", `export default module({ deps: [first, , 5, ...rest, ${PKG}] })`],
    ["a wrapped list", `export default module({ deps: [${PKG}] as const })`],
  ])("is true for a manifest listing the package in %s", (_, source) => {
    expect(listed(source)).toBe(true);
  });

  it.each([
    ["no default export", `export const deps = [${PKG}]`],
    ["a default function", `export default function deps() { return [${PKG}] }`],
    ["a default class", `export default class Deps { deps = [${PKG}] }`],
    ["a call without arguments", "export default module()"],
    ["a call over a spread", "export default module(...config)"],
    ["a call over a name", "export default module(config)"],
    ["no deps", "export default module({ id: 'recipes' })"],
    ["named deps", "export default module({ deps })"],
    ["a spread for deps", `export default module({ ...{ deps: [${PKG}] } })`],
    ["other deps", "export default module({ deps: ['@keel/std-i18n', '@keel/std-messages/tools'] })"],
    ["the name in another property", `export default module({ uses: [${PKG}], deps: [] })`],
    ["a syntax error", "export default module({ deps: ["],
  ])("is false for a manifest with %s", (_, source) => {
    expect(listed(source)).toBe(false);
  });

  it("is false for a file outside every module", () => {
    expect(dependsOn("modules/recipes/View.tsx", [])).toBe(false);
    expect(dependsOn("modules/other/View.tsx", [manifest(`export default { deps: [${PKG}] }`)])).toBe(false);
    const notManifest = manifest(`export default { deps: [${PKG}] }`, "modules/recipes/mymodule.ts");
    expect(dependsOn("modules/recipes/View.tsx", [notManifest])).toBe(false);
  });

  it("reads a manifest at the project root", () => {
    expect(dependsOn("View.tsx", [manifest(`export default { deps: [${PKG}] }`, "module.ts")])).toBe(true);
  });

  it("reads the manifest whose directory is the longest prefix of the path, in any file order", () => {
    const yes = `export default { deps: [${PKG}] }`;
    const no = "export default { deps: [] }";
    const outer = (source: string) => manifest(source, "modules/recipes/module.ts");
    const inner = (source: string) => manifest(source, "modules/recipes/admin/module.ts");
    const far = (source: string) => manifest(source, "modules/administration/module.ts");
    const path = "modules/recipes/admin/View.tsx";
    expect(dependsOn(path, [outer(no), inner(yes)])).toBe(true);
    expect(dependsOn(path, [inner(yes), outer(no)])).toBe(true);
    expect(dependsOn(path, [outer(yes), inner(no)])).toBe(false);
    expect(dependsOn(path, [inner(no), outer(yes)])).toBe(false);
    expect(dependsOn(path, [inner(yes), far(no)])).toBe(true);
    expect(dependsOn(path, [far(no), inner(yes)])).toBe(true);
    expect(dependsOn("modules/recipes/View.tsx", [outer(yes), inner(no)])).toBe(true);
    expect(dependsOn("modules/recipes/View.tsx", [far(yes), inner(yes)])).toBe(false);
  });
});
