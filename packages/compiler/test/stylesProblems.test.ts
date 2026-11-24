// k.topology Rules, E1587: the static read of each deployable's `styles` (stylesProblems) against a project folder
// whose packages export a stylesheet, a script and nothing else.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stylesProblems } from "../src/hosting/stylesProblems.ts";

let root = "";
const write = (rel: string, text: string): void => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
};
beforeAll(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-styles-"));
  write("package.json", JSON.stringify({ name: "app", type: "module" }));
  write("local.css", "a{}");
  write(
    "node_modules/sheet/package.json",
    JSON.stringify({ name: "sheet", exports: { "./base.css": "./base.css", "./script": "./script.js" } }),
  );
  write("node_modules/sheet/base.css", "a{}");
  write("node_modules/sheet/script.js", "export {}");
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const read = (source: string) => stylesProblems(source, root);
const messages = (source: string): string[] => read(source).map((p) => p.message);
const top = (body: string): string => `export default { ${body} }\n`;
const NOT_LITERAL = "web: a styles entry is not a string literal";
const entry = (spec: string, what: string): string =>
  `web: styles entry '${spec}' is ${what}`;

describe("stylesProblems", () => {
  it("accepts a package export that is a .css file, in every wrapper the declaration may take", () => {
    const body = "web: { modules: ['a'], adapter: 'node', styles: ['sheet/base.css'] }";
    for (const source of [
      top(body),
      `export default topology({ ${body} })\n`,
      `export default ({ ${body} })\n`,
      `export default { ${body} } as const\n`,
      `export default { ${body} } satisfies T\n`,
      `export default topology(({ ${body} } as const) satisfies T)\n`,
      top("web: ({ styles: (['sheet/base.css'] as const) satisfies readonly string[] } as const)"),
    ])
      expect(read(source), source).toEqual([]);
  });

  it("reports the same entry through each wrapper", () => {
    const body = "web: { styles: ['sheet/none.css'] }";
    const want = [entry("sheet/none.css", "no package export")];
    for (const source of [
      top(body),
      `export default topology({ ${body} })\n`,
      `export default ({ ${body} })\n`,
      `export default { ${body} } as const\n`,
      `export default { ${body} } satisfies T\n`,
      `export default topology(({ ${body} } as const) satisfies T, 1)\n`,
      top("web: ({ styles: (['sheet/none.css'] as const) satisfies readonly string[] } as const)"),
    ])
      expect(messages(source), source).toEqual(want);
  });

  it("names the deployable, the entry's offset and the reason, in source order", () => {
    const source = top(
      "web: { styles: ['sheet/base.css', './local.css', 'sheet/script', 'absent/x.css', 'sheet/other.css'] }, 'api-1': { styles: [x] }",
    );
    expect(read(source)).toEqual([
      { deployable: "web", offset: source.indexOf("'./local.css'"), message: entry("./local.css", "a path") },
      {
        deployable: "web",
        offset: source.indexOf("'sheet/script'"),
        message: entry("sheet/script", "an export that is not a .css file"),
      },
      {
        deployable: "web",
        offset: source.indexOf("'absent/x.css'"),
        message: entry("absent/x.css", "no package export"),
      },
      {
        deployable: "web",
        offset: source.indexOf("'sheet/other.css'"),
        message: entry("sheet/other.css", "no package export"),
      },
      {
        deployable: "api-1",
        offset: source.indexOf("[x]") + 1,
        message: "api-1: a styles entry is not a string literal",
      },
    ]);
  });

  it("a relative or absolute path is refused even when a .css file is there", () => {
    const absolute = path.join(root, "local.css");
    expect(absolute.startsWith("/")).toBe(true);
    expect(messages(top(`web: { styles: ['./local.css', '${absolute}', '../x.css', '.hidden/x.css'] }`))).toEqual([
      entry("./local.css", "a path"),
      entry(absolute, "a path"),
      entry("../x.css", "a path"),
      entry(".hidden/x.css", "a path"),
    ]);
  });

  it("resolves from the project folder given, not from the compiler's own", () => {
    const source = top("web: { styles: ['sheet/base.css'] }");
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "keel-styles-"));
    try {
      expect(stylesProblems(source, empty)).toEqual([
        { deployable: "web", offset: source.indexOf("'sheet"), message: entry("sheet/base.css", "no package export") },
      ]);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("an entry that is not a string literal is reported at the entry; a hole is skipped", () => {
    const source = top("web: { styles: [, 1, `sheet/base.css`, name, 'sheet/base.css', null, ...more] }");
    expect(read(source)).toEqual(
      ["1", "`sheet/base.css`", "name", "null", "...more"].map((text) => ({
        deployable: "web",
        offset: source.indexOf(text),
        message: NOT_LITERAL,
      })),
    );
  });

  it("a styles that is not an array literal is one problem at its value", () => {
    for (const value of ["list", "'sheet/base.css'", "{ a: 1 }", "(list as string[])"]) {
      const source = top(`web: { styles: ${value}, modules: [] }`);
      const inner = value.startsWith("(") ? "list" : value;
      expect(read(source), value).toEqual([
        { deployable: "web", offset: source.indexOf(inner), message: "web: styles is not an array literal" },
      ]);
    }
  });

  it("reads the styles key as an identifier or a string, and no computed, spread or other key", () => {
    expect(messages(top("web: { 'styles': [1] }"))).toEqual([NOT_LITERAL]);
    expect(messages(top('"web": { "styles": [1] }'))).toEqual([NOT_LITERAL]);
    for (const body of [
      "web: { ['styles']: [1] }",
      "web: { [styles]: [1] }",
      "web: { style: [1] }",
      "web: { ...rest }",
      "web: { 1: [1] }",
      "['web']: { styles: [1] }",
      "...rest",
      "web: [{ styles: [1] }]",
      "web: other",
      "web: 'styles'",
    ])
      expect(read(top(body)), body).toEqual([]);
  });

  it("a deployable whose key is neither an identifier nor a string has an empty name", () => {
    const source = top("1: { styles: [1] }");
    expect(read(source)).toEqual([
      { deployable: "", offset: source.indexOf("[1]") + 1, message: ": a styles entry is not a string literal" },
    ]);
  });

  it("checks every deployable and every styles key of it", () => {
    expect(
      read(top("a: { styles: [1] }, b: { modules: [] }, c: { styles: ['sheet/base.css'], 'styles': x }")).map(
        (p) => p.message,
      ),
    ).toEqual(["a: a styles entry is not a string literal", "c: styles is not an array literal"]);
  });

  it("gives none when there is no object to read", () => {
    for (const source of [
      "",
      "export const web = { web: { styles: [1] } }\n",
      "export default function web() { return { web: { styles: [1] } } }\n",
      "export default class Web { web = { styles: [1] } }\n",
      "export default interface Web { web: { styles: [1] } }\n",
      "export default topology()\n",
      "export default topology(...[{ web: { styles: [1] } }])\n",
      "export default topology(make({ web: { styles: [1] } }))\n",
      "export default [{ web: { styles: [1] } }]\n",
      "export default name\n",
      "export default { web: { styles: [1] } \n",
    ])
      expect(read(source), source).toEqual([]);
  });

  it("reads only the first argument of the call", () => {
    expect(messages("export default topology({ a: { styles: [1] } }, { b: { styles: [1] } })\n")).toEqual([
      "a: a styles entry is not a string literal",
    ]);
  });
});
