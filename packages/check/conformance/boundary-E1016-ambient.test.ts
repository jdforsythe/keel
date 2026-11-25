// Spec: k.boundary, Ambient types "`import.meta` is typed by TypeScript's lib, `@types/node` and k.bundle's Types alone. E1016 is a `/// <reference …/>` directive (`types`, `path`, `lib` or `no-default-lib`) in a project code file (E1576's files, k.security), tests included: `type reference in project code; import.meta.env and import types are Keel's` (75 units), at the directive, fix: delete its line. E1016, no fix, is also a declaration of the global `ImportMeta` or `ImportMetaEnv` in any other file the type pass loads (a project `declare global`, or Vite's, through `import 'vite/client'` or `import type {} from 'vite/client'`): once per declaring file, at its first such declaration when it is a project file, else at the first import, by path then position, of a project file through which the pass loads it: `<file> declares import.meta types; they are Keel's and Node's only`, `<file>` the project-relative path or package specifier of the declaring file, cut from its front to fit 89 units (60 without it)."
// Spec: k.boundary, Rules "E1016 a type reference, or an `import.meta` declaration not Keel's, Node's or TypeScript's (Ambient types; fix deletes a reference)"
// Spec: k.boundary, Conformance "`/// <reference types=\"vite/client\" />`, `/// <reference path=\"./g.d.ts\" />` and `/// <reference lib=\"dom\" />`, each as the first line of `modules/a/Page.tsx`, and the first as the first line of `modules/a/a.test.ts`, are each one E1016 at line 1, col 1, whose fix deletes that line; `/// <reference lib=\"es2023.intl\" />` in a file under `packages/` is none."
// Spec: k.boundary, Conformance "`import 'vite/client'` as the only import of `modules/a/Page.tsx` is one E1016 at that import whose message starts `vite/` and contains `declares import.meta types`; a file `modules/a/env.d.ts` holding `export {}` and `declare global { interface ImportMetaEnv { VITE_X: string } }` is one E1016 at `interface`; a project with neither, whose test file imports `vitest` and `@keel/testing`, reports no E1016."
// Seed 1337 (the properties below). The project is a temporary root whose `node_modules` resolves `@keel/compiler`, `@keel/testing`, `vite`, `vitest` and `@types/node`.
// Reading: "at that import" and "at `interface`" are the diagnostic's line and col; a package's declaration is found through a `node_modules` package the test writes.
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { ambientRoot, removeDir, rootOption, writeFileAt } from "./security-support.ts";
import { type Files, SEED } from "./support.ts";

let dir = "";
beforeAll(() => {
  dir = ambientRoot();
  writeFileAt(
    dir,
    "node_modules/aug-pkg/package.json",
    '{"name":"aug-pkg","version":"1.0.0","type":"module","types":"index.d.ts","exports":{".":{"types":"./index.d.ts"}}}\n',
  );
  writeFileAt(
    dir,
    "node_modules/aug-pkg/index.d.ts",
    "export {}\ndeclare global { interface ImportMeta { aug: string } }\n",
  );
});
afterAll(() => removeDir(dir));

const f = (path: string, source: string): Files[number] => ({ path, source });
const e1016 = (files: Files) => check(files, { root: rootOption(dir) }).diagnostics.filter((d) => d.code === "E1016");

const REF_MESSAGE = "type reference in project code; import.meta.env and import types are Keel's";
const DECL_TAIL = " declares import.meta types; they are Keel's and Node's only";
const BODY = "export const Page = 1\n";
const KINDS = [
  { directive: '/// <reference types="vite/client" />', extra: [] },
  { directive: '/// <reference path="./g.d.ts" />', extra: [f("modules/a/g.d.ts", "export {}\n")] },
  { directive: '/// <reference lib="dom" />', extra: [] },
  { directive: '/// <reference no-default-lib="true" />', extra: [] },
  { directive: '/// <reference types="node" />', extra: [] },
] as const;

describe("k.boundary Ambient types: a type reference in project code is E1016", () => {
  test('`/// <reference types="vite/client" />`, `/// <reference path="./g.d.ts" />` and `/// <reference lib="dom" />`, each as the first line of `modules/a/Page.tsx`, and the first as the first line of `modules/a/a.test.ts`, are each one E1016 at line 1, col 1, whose fix deletes that line', () => {
    const cases: [string, readonly Files[number][], string][] = [
      ['/// <reference types="vite/client" />', [], "modules/a/Page.tsx"],
      ['/// <reference path="./g.d.ts" />', [f("modules/a/g.d.ts", "export {}\n")], "modules/a/Page.tsx"],
      ['/// <reference lib="dom" />', [], "modules/a/Page.tsx"],
      ['/// <reference types="vite/client" />', [], "modules/a/a.test.ts"],
    ];
    for (const [directive, extra, path] of cases) {
      const files = [f(path, `${directive}\n${BODY}`), ...extra];
      const ds = e1016(files);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe(path);
      expect(ds[0]?.line).toBe(1);
      expect(ds[0]?.col).toBe(1);
      const fix = ds[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) continue;
      const patched = applyFix(files, fix).find((x) => x.path === path)?.source;
      expect(patched).toBe(BODY);
    }
  });

  test("the message is `type reference in project code; import.meta.env and import types are Keel's`, 75 units", () => {
    expect(REF_MESSAGE.length).toBe(75);
    const ds = e1016([f("modules/a/Page.tsx", `/// <reference lib="dom" />\n${BODY}`)]);
    expect(ds.map((d) => d.message)).toEqual([REF_MESSAGE]);
  });

  test("property: each of `types`, `path`, `lib` and `no-default-lib`, in any project code file outside `packages/`, `node_modules/` and `.keel/`, tests included, is one E1016 at 1:1 whose fix leaves the rest of the file and clears it", () => {
    const where = fc.constantFrom(
      "modules/a/Page.tsx",
      "modules/a/a.test.ts",
      "modules/a/load.server.ts",
      "lib/x.ts",
      "topology.ts",
      "src/deep/er/x.ts",
      "x.ts",
    );
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), where, (kind, path) => {
        const files = [f(path, `${kind.directive}\n${BODY}`), ...kind.extra];
        const ds = e1016(files).filter((d) => d.message === REF_MESSAGE);
        expect(ds).toHaveLength(1);
        expect([ds[0]?.path, ds[0]?.line, ds[0]?.col]).toEqual([path, 1, 1]);
        const fix = ds[0]?.fix;
        expect(typeof fix).toBe("string");
        if (fix === undefined) return;
        const patched = applyFix(files, fix);
        expect(patched.find((x) => x.path === path)?.source).toBe(BODY);
        expect(e1016(patched).filter((d) => d.message === REF_MESSAGE)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test('`/// <reference lib="es2023.intl" />` in a file under `packages/` is none, and so are `node_modules/` and `.keel/` files (E1576\'s files)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom("packages/x/src/a.ts", "packages/y/index.ts", ".keel/gen/a.ts", "node_modules/p/index.ts"),
        fc.constantFrom(...KINDS),
        (path, kind) => {
          expect(e1016([f(path, `${kind.directive}\n${BODY}`), ...kind.extra])).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
    expect(e1016([f("packages/x/src/a.ts", `/// <reference lib="es2023.intl" />\n${BODY}`)])).toEqual([]);
  });
});

describe("k.boundary Ambient types: a declaration of the global ImportMeta or ImportMetaEnv is E1016, once per declaring file", () => {
  test("`import 'vite/client'` as the only import of `modules/a/Page.tsx` is one E1016 at that import whose message starts `vite/` and contains `declares import.meta types`", () => {
    const ds = e1016([f("modules/a/Page.tsx", `import 'vite/client'\n${BODY}`)]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/Page.tsx");
    expect(ds[0]?.line).toBe(1);
    expect(ds[0]?.message.startsWith("vite/")).toBe(true);
    expect(ds[0]?.message).toContain("declares import.meta types");
    expect(ds[0]?.message.endsWith(DECL_TAIL)).toBe(true);
    expect(ds[0]?.fix).toBeUndefined();
  });

  test("`import type {} from 'vite/client'` is one E1016 too, and when two files import it the finding sits at the first, by path then position", () => {
    const one = e1016([f("modules/a/Page.tsx", `import type {} from 'vite/client'\n${BODY}`)]);
    expect(one).toHaveLength(1);
    expect(one[0]?.path).toBe("modules/a/Page.tsx");
    const two = e1016([
      f("modules/b/B.ts", `import 'vite/client'\n${BODY}`),
      f("modules/a/A.ts", `${BODY}import 'vite/client'\n`),
    ]);
    expect(two).toHaveLength(1);
    expect(two[0]?.path).toBe("modules/a/A.ts");
  });

  test("a file `modules/a/env.d.ts` holding `export {}` and `declare global { interface ImportMetaEnv { VITE_X: string } }` is one E1016 at `interface`", () => {
    const source = "export {}\ndeclare global { interface ImportMetaEnv { VITE_X: string } }\n";
    const ds = e1016([f("modules/a/env.d.ts", source)]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/env.d.ts");
    expect(ds[0]?.line).toBe(2);
    expect(ds[0]?.col).toBe((source.split("\n")[1] ?? "").indexOf("interface") + 1);
    expect(ds[0]?.message).toBe(`modules/a/env.d.ts${DECL_TAIL}`);
    expect(ds[0]?.fix).toBeUndefined();
  });

  test("property: one E1016 per declaring file, at its first declaration of `ImportMeta` or `ImportMetaEnv`, however many it holds", () => {
    const decl = fc.constantFrom(
      "interface ImportMeta { a: string }",
      "interface ImportMetaEnv { A: string }",
      "interface ImportMeta { b: number }",
    );
    fc.assert(
      fc.property(fc.array(decl, { minLength: 1, maxLength: 4 }), fc.constantFrom(0, 1, 2), (decls, pad) => {
        const lines = [
          "export {}",
          ...Array.from({ length: pad }, (_, i) => `export const p${i} = ${i}`),
          `declare global { ${decls.join("; ")} }`,
        ];
        const source = `${lines.join("\n")}\n`;
        const ds = e1016([f("modules/a/env.d.ts", source)]);
        expect(ds).toHaveLength(1);
        const row = lines.length;
        expect(ds[0]?.line).toBe(row);
        expect(ds[0]?.col).toBe((lines[row - 1] ?? "").indexOf("interface") + 1);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a declaration in each of two project files is two E1016, one per file", () => {
    const decl = (n: string) =>
      f(`modules/a/${n}.d.ts`, "export {}\ndeclare global { interface ImportMeta { x: string } }\n");
    const ds = e1016([decl("one"), decl("two")]);
    expect(ds.map((d) => d.path).sort()).toEqual(["modules/a/one.d.ts", "modules/a/two.d.ts"]);
  });

  test("a package whose types augment `ImportMeta` is one E1016 at the first import, by path then position, of a project file through which the pass loads it", () => {
    const ds = e1016([
      f("modules/b/B.ts", `import 'aug-pkg'\n${BODY}`),
      f("modules/a/A.ts", `${BODY}import 'aug-pkg'\nimport 'aug-pkg'\n`),
    ]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/A.ts");
    expect(ds[0]?.line).toBe(2);
    expect(ds[0]?.message.endsWith(DECL_TAIL)).toBe(true);
  });

  test("the message holds the declaring file cut from its front to fit 89 units; 60 units without it", () => {
    expect(DECL_TAIL.length).toBe(60);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (depth) => {
        const path = `modules/a/${Array.from({ length: depth }, (_, i) => `folder${i}x`).join("/")}/env.d.ts`;
        const ds = e1016([f(path, "export {}\ndeclare global { interface ImportMetaEnv { A: string } }\n")]);
        expect(ds).toHaveLength(1);
        const m = ds[0]?.message ?? "";
        expect(m.length).toBeLessThanOrEqual(89);
        expect(m.endsWith(DECL_TAIL)).toBe(true);
        if (path.length + DECL_TAIL.length <= 89) expect(m).toBe(`${path}${DECL_TAIL}`);
        else {
          // Reading: the cut file is `path` with leading segments dropped (behind one `.../` as k.check Diagnostics drops them, or bare), and it fits the 29 units the tail leaves.
          const shown = m.slice(0, m.length - DECL_TAIL.length);
          expect(shown.length).toBeLessThanOrEqual(29);
          expect(shown.length).toBeGreaterThan(0);
          expect(path.endsWith(shown.replace(/^\.\.\.\//, ""))).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});

describe("k.boundary Ambient types: what is not reported", () => {
  test("a project with neither a reference nor a declaration, whose test file imports `vitest` and `@keel/testing`, reports no E1016", () => {
    const ds = e1016([
      f("modules/a/Page.tsx", BODY),
      f(
        "modules/a/a.test.ts",
        "import { expect, test } from 'vitest'\nimport * as kt from '@keel/testing'\ntest('t', () => expect(kt).toBeDefined())\n",
      ),
    ]);
    expect(ds).toEqual([]);
  });

  test("a module-scoped `interface ImportMeta` (no `declare global`) declares no global and is none", () => {
    expect(
      e1016([
        f(
          "modules/a/local.ts",
          "interface ImportMeta { x: string }\nexport const a: ImportMeta | undefined = undefined\n",
        ),
      ]),
    ).toEqual([]);
  });

  test("reading `import.meta.env.MODE` and `import.meta.url` with no reference is none", () => {
    expect(
      e1016([f("modules/a/Page.tsx", "export const m = import.meta.env.MODE\nexport const u = import.meta.url\n")]),
    ).toEqual([]);
  });
});
