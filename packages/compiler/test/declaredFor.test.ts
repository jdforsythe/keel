// k.origins Rules: which deployables serve a file, and whether each of them declares an origin (declaredFor).
// Seed 1337 for the property.
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { declaredFor } from "../src/hosting/declaredFor.ts";

const WEB = "https://web.example";
const API = "https://api.example";
const BOTH = "https://both.example";
const file = (path: string, source = "") => ({
  path,
  program: parseSync(path, source, { sourceType: "module", lang: "ts" }).program,
});
const origins = (directive: string, list: readonly string[]): string =>
  `{ ${directive}: { ${list.map((o) => `'${o}': 'needed'`).join(", ")} } }`;
const TOPOLOGY = `import { topology } from '@keel/server'
export default topology({
  web: { modules: ['a', 'both'], adapter: 'node', origins: { img: { '${WEB}': 'pictures', '${BOTH}': 'shared' }, connect: { '${BOTH}': 'shared' } } },
  api: { modules: ['b', 'both'], adapter: 'node', origins: { img: { '${API}': 'pictures', '${BOTH}': 'shared' } } },
})
`;
const FILES = [
  file(
    "modules/a/x.ts",
    [
      "import { u } from './util.ts'",
      "import { lib } from '../../shared/lib'",
      "import { dir } from '../../shared/dir'",
      "import { page } from '../../shared/page'",
      "import raw from '../../shared/raw.ts?raw'",
      "import type { T } from '../../shared/typed.ts'",
      "export { again } from '../../shared/again.ts'",
      "export type { U } from '../../shared/typedAgain.ts'",
      "export const later = () => import('../../shared/later.ts')",
      "import { gone } from '../../shared/gone.ts'",
    ].join("\n"),
  ),
  file("modules/a/util.ts"),
  file("modules/b/y.ts", "import { two } from '../../shared/two.ts'\nimport { rooted } from 'shared/bare.ts'"),
  file("modules/both/z.ts", "import { two } from '../../shared/two.ts'"),
  file("modules/c/w.ts", "import { own } from '../../shared/own.ts'"),
  file("shared/lib.ts", "import { deep } from './deep.ts'"),
  file("shared/deep.ts", "import { deeper } from './deeper/index.ts'"),
  file("shared/deeper/index.ts"),
  file("shared/dir/index.ts"),
  file("shared/page/index.tsx"),
  file("shared/raw.ts"),
  file("shared/typed.ts"),
  file("shared/typedAgain.ts"),
  file("shared/again.ts"),
  file("shared/later.ts"),
  file("shared/two.ts", "import { loop } from './loop.ts'"),
  file("shared/loop.ts", "import { two } from './two.ts'"),
  file("shared/own.ts"),
  file("shared/bare.ts"),
  file("modules/b/shared/bare.ts"),
  file("lib/modules/a/nested.ts"),
  file("modules/a.ts"),
];
const declared = declaredFor(FILES, TOPOLOGY);
const img = (path: string): string[] => [WEB, API, BOTH].filter((o) => declared(path, "img", o));

describe("declaredFor", () => {
  it("a module's file asks the deployables listing its module", () => {
    expect(img("modules/a/x.ts")).toEqual([WEB, BOTH]);
    expect(img("modules/a/util.ts")).toEqual([WEB, BOTH]);
    expect(img("modules/b/y.ts")).toEqual([API, BOTH]);
    expect(img("modules/both/z.ts")).toEqual([BOTH]);
    expect(img("modules/a/not-in-the-list.ts")).toEqual([WEB, BOTH]);
  });

  it("a file outside modules asks the deployables of the modules that import it, through other files too", () => {
    for (const path of [
      "shared/lib.ts",
      "shared/deep.ts",
      "shared/deeper/index.ts",
      "shared/dir/index.ts",
      "shared/page/index.tsx",
      "shared/raw.ts",
      "shared/again.ts",
      "shared/later.ts",
    ])
      expect(img(path), path).toEqual([WEB, BOTH]);
  });

  it("a file two modules import asks the deployables of both, and an import cycle ends", () => {
    expect(img("shared/two.ts")).toEqual([BOTH]);
    expect(img("shared/loop.ts")).toEqual([BOTH]);
  });

  it("a type-only import or re-export, and a bare specifier, serve nothing", () => {
    for (const path of ["shared/typed.ts", "shared/typedAgain.ts", "shared/bare.ts"])
      expect(img(path), path).toEqual([BOTH]);
  });

  it("a file no module holds or imports, or whose module no deployable lists, asks every deployable", () => {
    for (const path of [
      "unknown.ts",
      "shared/gone.ts",
      "lib/modules/a/nested.ts",
      "modules/a.ts",
      "modules/c/w.ts",
      "shared/own.ts",
    ])
      expect(img(path), path).toEqual([BOTH]);
  });

  it("an origin counts under its own directive only, and only as an own key of it", () => {
    expect(declared("modules/a/x.ts", "connect", BOTH)).toBe(true);
    expect(declared("modules/a/x.ts", "connect", WEB)).toBe(false);
    expect(declared("modules/a/x.ts", "font", WEB)).toBe(false);
    expect(declared("modules/b/y.ts", "connect", BOTH)).toBe(false);
    expect(declared("unknown.ts", "connect", BOTH)).toBe(false);
    for (const key of ["toString", "constructor", "__proto__", ""]) {
      expect(declared("modules/a/x.ts", "img", key), key).toBe(false);
      expect(declared("modules/a/x.ts", "font", key), key).toBe(false);
    }
  });

  it("is false for every file when the topology has no deployable or cannot be read", () => {
    for (const source of ["export default topology({})\n", "", "export default {"]) {
      const none = declaredFor(FILES, source);
      for (const path of ["modules/a/x.ts", "unknown.ts"])
        for (const directive of ["img", "connect"] as const) expect(none(path, directive, WEB), source).toBe(false);
    }
  });

  it("a deployable with no origins declares none", () => {
    const d = declaredFor(
      FILES,
      `export default topology({ web: { modules: ['a'], adapter: 'node' }, api: { modules: ['b'], adapter: 'node', origins: ${origins("img", [API])} } })\n`,
    );
    expect(d("modules/a/x.ts", "img", API)).toBe(false);
    expect(d("modules/b/y.ts", "img", API)).toBe(true);
    expect(d("unknown.ts", "img", API)).toBe(false);
  });

  it("agrees with the rule read off the topology: every serving deployable declares the origin", () => {
    const MODULES: readonly string[] = ["m0", "m1", "m2", "m3"];
    const ORIGINS: readonly string[] = ["https://o0.example", "https://o1.example", "https://o2.example"];
    const deployable = fc.record({
      modules: fc.subarray([...MODULES]),
      origins: fc.subarray([...ORIGINS]),
    });
    fc.assert(
      fc.property(
        fc.array(deployable, { minLength: 0, maxLength: 4 }),
        // importers[i]: the modules whose file imports shared file i
        fc.array(fc.subarray([...MODULES]), { minLength: 1, maxLength: 3 }),
        (deployables, importers) => {
          const source = `export default topology({ ${deployables
            .map(
              (d, i) =>
                `d${i}: { modules: [${d.modules.map((m) => `'${m}'`).join(", ")}], adapter: 'node', origins: ${origins("img", d.origins)} }`,
            )
            .join(", ")} })\n`;
          const files = [
            ...MODULES.map((m) =>
              file(
                `modules/${m}/index.ts`,
                importers.flatMap((ms, i) => (ms.includes(m) ? [`import '../../shared/s${i}.ts'`] : [])).join("\n"),
              ),
            ),
            ...importers.map((_, i) => file(`shared/s${i}.ts`)),
          ];
          const check = declaredFor(files, source);
          const want = (modules: readonly string[], origin: string): boolean => {
            const serving = deployables.filter((d) => d.modules.some((m) => modules.includes(m)));
            const each = serving.length > 0 ? serving : deployables;
            return each.length > 0 && each.every((d) => d.origins.includes(origin));
          };
          for (const o of ORIGINS) {
            for (const m of MODULES) expect(check(`modules/${m}/index.ts`, "img", o)).toBe(want([m], o));
            importers.forEach((ms, i) => {
              expect(check(`shared/s${i}.ts`, "img", o)).toBe(want(ms, o));
            });
            expect(check("elsewhere.ts", "img", o)).toBe(want([], o));
          }
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
