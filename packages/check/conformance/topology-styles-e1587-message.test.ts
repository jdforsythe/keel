// Spec: k.topology, E1587's message "**E1587's message.** `<name>: styles is not an array literal`, `<name>: a styles entry is not a string literal`, or `<name>: styles entry '<spec>' is ` then `a path`, `no package export` or `an export that is not a .css file`, `<spec>` shortened from its front past the bound (k.check Diagnostics); the remedy, a package export that is a `.css` file, is `keel explain`'s. `web: styles entry './x.css' is a path` is 37 units; `web: styles entry '@keel/ui/tokens.json' is an export that is not a .css file`, 77."
// Seed 1337 (the property). In-memory project, `check(files, { types: false, root })` with `root` this package, whose node_modules resolve `@keel/ui`.
// The spec's 77-unit example names `@keel/ui/tokens.json`, which is no export of @keel/ui in this repository, so it is not reproduced: `@keel/ui/brand` stands for it.
// ASSUMPTIONS: a specifier naming no export of an installed package (`@keel/ui/nope`) is `no package export`; how `<spec>` is shortened from its front (a marker, how many segments) is not stated, so only the bound, the head `<name>: styles entry '` and the tail `' is a path` and the spec's own tail are asserted.
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/a/module.ts",
  "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
);
const project = (name: string, styles: string, prelude = ""): Files => [
  f(
    "topology.ts",
    `import { topology } from '@keel/server'\n${prelude}export default topology({ ${name}: { modules: ['a'], adapter: 'client', styles: ${styles} } })\n`,
  ),
  MANIFEST,
];
const messages = (files: Files): string[] =>
  check(files, { types: false, root: ROOT })
    .diagnostics.filter((d) => d.code === "E1587")
    .map((d) => d.message);

describe("k.topology: E1587's message", () => {
  test("`'./x.css'` is `web: styles entry './x.css' is a path`, 37 units", () => {
    const m = messages(project("web", "['./x.css']"));
    expect(m).toEqual(["web: styles entry './x.css' is a path"]);
    expect(m[0]?.length).toBe(37);
  });

  test("`'@keel/ui/brand'`, an export that is a script, is `web: styles entry '@keel/ui/brand' is an export that is not a .css file`", () => {
    const m = messages(project("web", "['@keel/ui/brand']"));
    expect(m).toEqual(["web: styles entry '@keel/ui/brand' is an export that is not a .css file"]);
    expect(m[0]?.length).toBeLessThanOrEqual(89);
  });

  test("a specifier no export of its package names is `web: styles entry '@keel/ui/nope' is no package export`", () => {
    expect(messages(project("web", "['@keel/ui/nope']"))).toEqual([
      "web: styles entry '@keel/ui/nope' is no package export",
    ]);
  });

  test("a variable entry is `web: a styles entry is not a string literal`", () => {
    expect(messages(project("web", "[fonts]", "const fonts = '@keel/ui/fonts'\n"))).toEqual([
      "web: a styles entry is not a string literal",
    ]);
  });

  test("a `styles` that is not an array literal is `web: styles is not an array literal`", () => {
    expect(messages(project("web", "fonts", "const fonts = ['@keel/ui/fonts']\n"))).toEqual([
      "web: styles is not an array literal",
    ]);
  });

  test("a path of any length is a message of at most 89 units, `<name>: styles entry '` then the spec's tail then `' is a path`", () => {
    const seg = fc.stringMatching(/^[a-z]{1,12}$/);
    fc.assert(
      fc.property(fc.array(seg, { minLength: 1, maxLength: 12 }), (segs) => {
        const spec = `./${segs.join("/")}.css`;
        const m = messages(project("web", `['${spec}']`));
        expect(m).toHaveLength(1);
        const msg = m[0] ?? "";
        expect(msg.length).toBeLessThanOrEqual(89);
        expect(msg.startsWith("web: styles entry '")).toBe(true);
        expect(msg.endsWith("' is a path")).toBe(true);
        expect(msg).toContain(`${segs.at(-1)}.css'`);
        if (`web: styles entry '${spec}' is a path`.length <= 89)
          expect(msg).toBe(`web: styles entry '${spec}' is a path`);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
