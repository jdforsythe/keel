import { localeFile, missingMessage, placeholderParams, undeclaredKey, unusedKey } from "@keel/std-messages/tools";
// E2401 to E2405: the exact findings of each rule (position, message, fix edits) and the files it leaves alone.
import { describe, expect, it } from "vitest";
import { CLEAN, MODULE } from "./support.ts";
import { applied, at, pos, run } from "./tooling.ts";

const SET = "modules/recipes/RecipesText.schema.ts";
const EN = "modules/recipes/RecipesText/en-US.ts";
const DE = "modules/recipes/RecipesText/de-DE.ts";
const VIEW = "modules/recipes/RecipeList.tsx";
const MANIFEST = "modules/recipes/module.ts";
const UNLISTED = MODULE.replace("'@keel/std-messages', ", "");
const EXACT = "(locale) => import(`./RecipesText/${locale}.ts`)";
const LOAD_MSG = "RecipesText load is not the import of ./RecipesText/${locale}.ts";

/** The clean module with files replaced, or removed by `null`. */
const tree = (overrides: Record<string, string | null> = {}): Record<string, string> =>
  Object.fromEntries(Object.entries({ ...CLEAN, ...overrides }).flatMap(([p, s]) => (s === null ? [] : [[p, s]])));
const clean = (path: string): string => {
  const source = CLEAN[path];
  if (source === undefined) throw new Error(`no clean ${path}`);
  return source;
};
const schema = (rest: string): string =>
  `import { s } from '@keel/schema'\nimport { messages } from '@keel/std-messages'\nimport { AppLocale } from './AppLocale.schema.ts'\n${rest}\n`;
const entry = (object: string): string =>
  `import { RecipesText } from '../RecipesText.schema.ts'\nexport default RecipesText.text(${object})\n`;

describe("E2401", () => {
  it("reports nothing on the clean module", () => {
    expect(run(localeFile, tree(), SET)).toEqual([]);
  });

  it("names each locale without a file, at the `messages` call, with no fix", () => {
    const source = clean(SET);
    expect(run(localeFile, tree({ [DE]: null, [EN]: null }), SET)).toEqual([
      {
        at: pos(source, "messages(AppLocale"),
        message: "locale 'en-US' of RecipesText has no file RecipesText/en-US.ts",
        fix: null,
      },
      {
        at: pos(source, "messages(AppLocale"),
        message: "locale 'de-DE' of RecipesText has no file RecipesText/de-DE.ts",
        fix: null,
      },
    ]);
    const elsewhere = tree({
      [DE]: null,
      "modules/other/RecipesText/de-DE.ts": clean(DE),
      "RecipesText/de-DE.ts": clean(DE),
    });
    expect(run(localeFile, elsewhere, SET).map((f) => f.message)).toEqual([
      "locale 'de-DE' of RecipesText has no file RecipesText/de-DE.ts",
    ]);
  });

  it("replaces a load that is not the exact import", () => {
    const load = "(locale) => import('./RecipesText/en-US.ts')";
    const source = clean(SET).replace(EXACT, load);
    const found = run(localeFile, tree({ [SET]: source }), SET);
    expect(found).toEqual([
      {
        at: pos(source, load),
        message: LOAD_MSG,
        fix: [{ start: at(source, load), end: at(source, load) + load.length, text: EXACT }],
      },
    ]);
    expect(applied(source, found[0]?.fix ?? [])).toBe(clean(SET));
  });

  it("adds a load after the keys when there is none", () => {
    const source = clean(SET).replace(`, ${EXACT}`, "");
    const found = run(localeFile, tree({ [SET]: source }), SET);
    const after = at(source, "total: { n: s.int() } }") + "total: { n: s.int() } }".length;
    expect(found).toEqual([
      {
        at: pos(source, "messages(AppLocale"),
        message: LOAD_MSG,
        fix: [{ start: after, end: after, text: `, ${EXACT}` }],
      },
    ]);
    expect(applied(source, found[0]?.fix ?? [])).toBe(clean(SET));
  });

  it("checks each set of the file, and only the load of a set whose locales it cannot read", () => {
    const source = schema(
      "export const RecipesText = messages(AppLocale, { title: {} }, load)\nexport const MenuText = messages(s.enum(['fr-FR']), { open: {} }, (l) => import(`./MenuText/${l}.ts`))\nexport const NavText = messages(Unknown, { back: {} }, (l) => import(`./NavText/${l}.ts`))\nexport const SideText = messages(AppLocale, { top: {} }, (l) => import(`./SideText/${l}.ts`))",
    );
    expect(run(localeFile, tree({ [SET]: source }), SET).map((f) => [f.at, f.message])).toEqual([
      [pos(source, "load)"), LOAD_MSG],
      [pos(source, "messages(AppLocale, { top"), "locale 'en-US' of SideText has no file SideText/en-US.ts"],
      [pos(source, "messages(AppLocale, { top"), "locale 'de-DE' of SideText has no file SideText/de-DE.ts"],
    ]);
  });

  it("reads `*.schema.ts` files of a module listing the package, and no other", () => {
    const broken = clean(SET).replace(EXACT, "load");
    expect(run(localeFile, tree({ "modules/recipes/sets.ts": broken, [DE]: null }), "modules/recipes/sets.ts")).toEqual(
      [],
    );
    expect(run(localeFile, tree({ [SET]: broken, [DE]: null, [MANIFEST]: UNLISTED }), SET)).toEqual([]);
    expect(run(localeFile, tree({ [SET]: broken, [DE]: null }), SET)).toHaveLength(2);
  });
});

describe("E2402", () => {
  it("names each declared key a locale file lacks, at its entry object, with no fix", () => {
    const source = entry("{ count: { plural: 'n', other: '# Rezepte' } }");
    expect(run(missingMessage, tree({ [DE]: source }), DE)).toEqual([
      { at: pos(source, "{ count"), message: "RecipesText/de-DE.ts lacks message 'title'", fix: null },
      { at: pos(source, "{ count"), message: "RecipesText/de-DE.ts lacks message 'total'", fix: null },
    ]);
    expect(run(missingMessage, tree(), DE)).toEqual([]);
  });

  it("reads only the locale files of a set, in a module listing the package", () => {
    const source = entry("{}");
    expect(run(missingMessage, tree({ [DE]: source }), DE)).toHaveLength(3);
    expect(run(missingMessage, tree({ [DE]: source, [MANIFEST]: UNLISTED }), DE)).toEqual([]);
    expect(
      run(missingMessage, tree({ "modules/recipes/OtherText/de-DE.ts": source }), "modules/recipes/OtherText/de-DE.ts"),
    ).toEqual([]);
    expect(run(missingMessage, tree({ "modules/recipes/de-DE.ts": source }), "modules/recipes/de-DE.ts")).toEqual([]);
    expect(run(missingMessage, tree(), VIEW)).toEqual([]);
    expect(run(missingMessage, tree({ [DE]: "export default {}\n" }), DE)).toEqual([]);
    expect(run(missingMessage, tree({ [DE]: "export const entry = 1\n" }), DE)).toEqual([]);
  });
});

describe("E2403", () => {
  const TITLE = "title: 'Rezepte'";
  const REST = "count: { plural: 'n', other: '#' }, total: { text: '{n}' }";

  it("names a key the set does not declare, at the key, and removes it with the comma that joins it", () => {
    const first = entry(`{ extra: 'x', ${TITLE}, ${REST} }`);
    expect(run(undeclaredKey, tree({ [DE]: first }), DE)).toEqual([
      {
        at: pos(first, "extra"),
        message: "RecipesText declares no key 'extra'",
        fix: [{ start: at(first, "extra"), end: at(first, "title"), text: "" }],
      },
    ]);
    const last = entry(`{ ${TITLE}, ${REST}, 'more-text': 'x' }`);
    const found = run(undeclaredKey, tree({ [DE]: last }), DE);
    expect(found.map((f) => [f.at, f.message])).toEqual([
      [pos(last, "'more-text'"), "RecipesText declares no key 'more-text'"],
    ]);
    expect(applied(last, found[0]?.fix ?? [])).toBe(entry(`{ ${TITLE}, ${REST} }`));
    const only = entry("{ extra: 'x' }");
    expect(applied(only, run(undeclaredKey, tree({ [DE]: only }), DE)[0]?.fix ?? [])).toBe(entry("{  }"));
  });

  it("counts spreads and computed keys as items when it removes, and reports neither", () => {
    const source = entry(`{ ${TITLE}, ...shared, extra: 'x', [key]: 'y', ${REST} }`);
    const found = run(undeclaredKey, tree({ [DE]: source }), DE);
    expect(found.map((f) => f.message)).toEqual(["RecipesText declares no key 'extra'"]);
    expect(applied(source, found[0]?.fix ?? [])).toBe(entry(`{ ${TITLE}, ...shared, [key]: 'y', ${REST} }`));
  });

  it("reads only the locale files of a set, in a module listing the package", () => {
    const source = entry("{ extra: 'x' }");
    expect(run(undeclaredKey, tree({ [DE]: source, [MANIFEST]: UNLISTED }), DE)).toEqual([]);
    expect(run(undeclaredKey, tree({ "modules/recipes/extra.ts": source }), "modules/recipes/extra.ts")).toEqual([]);
    expect(run(undeclaredKey, tree({ [DE]: "export default { extra: 'x' }\n" }), DE)).toEqual([]);
  });
});

describe("E2404", () => {
  const reads = (...keys: string[]): string =>
    `export default function RecipeList(props) {\n  return <main>${keys.map((k) => `{props.data.text.${k}}`).join("")}</main>\n}\n`;

  it("names each key no file reads, at the key, and removes it from the declaration", () => {
    const source = clean(SET);
    const found = run(unusedKey, tree({ [VIEW]: reads("count") }), SET);
    expect(found).toEqual([
      {
        at: pos(source, "title: {}"),
        message: "message key 'title' of RecipesText is never read",
        fix: [{ start: at(source, "title: {}"), end: at(source, "count:"), text: "" }],
      },
      {
        at: pos(source, "total:"),
        message: "message key 'total' of RecipesText is never read",
        fix: [
          {
            start: at(source, " }, total") + 2,
            end: at(source, "total: { n: s.int() }") + "total: { n: s.int() }".length,
            text: "",
          },
        ],
      },
    ]);
    expect(applied(source, found[1]?.fix ?? [])).toContain("{ title: {}, count: { n: s.int({ min: 0 }) } }, (locale)");
    expect(run(unusedKey, tree(), SET)).toEqual([]);
  });

  it("counts a read in any other project file", () => {
    const other = { "modules/other/Card.tsx": "export const Card = (p) => <b>{p.text?.title}{p.text.total}</b>\n" };
    expect(run(unusedKey, tree({ [VIEW]: reads("count"), ...other }), SET)).toEqual([]);
  });

  it("does not count the schema file, the set's own locale files, computed members or a file that does not parse", () => {
    const source = `${clean(SET)}export const fallback = (t) => t.title\n`;
    const files = tree({
      [SET]: source,
      [VIEW]:
        "export default function RecipeList(props) {\n  const t = props.data.text\n  return <main>{t.count}{t.total}{t[title]}{t['title']}</main>\n}\n",
      [DE]: "import { RecipesText } from '../RecipesText.schema.ts'\nexport default RecipesText.text({ title: base.title })\n",
      "modules/recipes/broken.ts": "export const x = t.title +\n",
    });
    expect(run(unusedKey, files, SET).map((f) => f.message)).toEqual([
      "message key 'title' of RecipesText is never read",
    ]);
    const sibling = { ...files, "modules/recipes/RecipesTextExtra/de-DE.ts": "export const x = t.title\n" };
    expect(run(unusedKey, sibling, SET)).toEqual([]);
    const elsewhere = { ...files, "modules/other/RecipesText/de-DE.ts": "export const x = t.title\n" };
    expect(run(unusedKey, elsewhere, SET)).toEqual([]);
  });

  it("reads `*.schema.ts` files of a module listing the package, and no other", () => {
    const view = reads("count");
    expect(
      run(unusedKey, tree({ [VIEW]: view, "modules/recipes/sets.ts": clean(SET) }), "modules/recipes/sets.ts"),
    ).toEqual([]);
    expect(run(unusedKey, tree({ [VIEW]: view, [MANIFEST]: UNLISTED }), SET)).toEqual([]);
    expect(run(unusedKey, tree({ [VIEW]: view, [MANIFEST]: null }), SET)).toEqual([]);
  });

  it("checks each set of a root-level schema file against its own locale directory", () => {
    const source = schema(
      "export const A = messages(AppLocale, { one: {} }, load)\nexport const B = messages(AppLocale, { two: {} }, load)",
    );
    const files = {
      "module.ts": MODULE,
      "Sets.schema.ts": source,
      "A/en-US.ts": "export const x = t.one + t.two\n",
    };
    expect(run(unusedKey, files, "Sets.schema.ts").map((f) => f.message)).toEqual([
      "message key 'one' of A is never read",
    ]);
  });
});

describe("E2405", () => {
  const TITLE = "title: 'Rezepte', count: { plural: 'n', other: '# Rezepte' }";

  it("renames a placeholder to the one param its template leaves out", () => {
    const source = entry(`{ ${TITLE}, total: { text: 'Summe {m}' } }`);
    const found = run(placeholderParams, tree({ [DE]: source }), DE);
    expect(found).toEqual([
      {
        at: pos(source, "m}"),
        message: "{m} is not a param of 'total'",
        fix: [{ start: at(source, "m}"), end: at(source, "m}") + 1, text: "n" }],
      },
    ]);
    expect(applied(source, found[0]?.fix ?? [])).toBe(entry(`{ ${TITLE}, total: { text: 'Summe {n}' } }`));
    expect(run(placeholderParams, tree(), DE)).toEqual([]);
  });

  it("reports a brace outside a placeholder and a plural over no number param, with no fix", () => {
    const source = entry("{ title: 'a{b', count: { plural: 'm', other: '#' }, total: 'Summe {n}' }");
    expect(run(placeholderParams, tree({ [DE]: source }), DE)).toEqual([
      { at: pos(source, "a{b"), message: "message 'title' has a brace outside a {param} placeholder", fix: null },
      { at: pos(source, "m'"), message: "plural 'm' is not a number param of 'count'", fix: null },
    ]);
  });

  it("checks declared keys only, in the locale files of a module listing the package", () => {
    const source = entry(`{ ${TITLE}, total: 'Summe {n}', extra: '{x} {', [key]: '{y}' }`);
    expect(run(placeholderParams, tree({ [DE]: source }), DE)).toEqual([]);
    const bad = entry("{ title: '{x}' }");
    expect(run(placeholderParams, tree({ [DE]: bad }), DE)).toHaveLength(1);
    expect(run(placeholderParams, tree({ [DE]: bad, [MANIFEST]: UNLISTED }), DE)).toEqual([]);
    expect(run(placeholderParams, tree({ "modules/recipes/bad.ts": bad }), "modules/recipes/bad.ts")).toEqual([]);
    expect(run(placeholderParams, tree({ [DE]: "export default { title: '{x}' }\n" }), DE)).toEqual([]);
  });
});
