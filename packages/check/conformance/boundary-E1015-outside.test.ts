// k.boundary, Following "Reach, and k.origins' file importing another, follow a specifier to the project file k.bundle Aliases resolves it to (relative, the project's own name, a workspace link or a `node_modules` symlink whose real path is a project file), its query stripped; one resolving under `node_modules/` or outside the project is a package's, not followed (E1007 holds at build). An `import()` of a template literal whose text before its first substitution starts `./` or `../` reaches each project file its pattern matches, each substitution read as `*` within one path segment, as Vite expands it; any other non-literal `import()` (W1608) reaches nothing, and E1007 holds at build. E1015 is a relative specifier in a non-test project code file that resolves to a file outside the project root: `keel check` reads only the project's files, so no rule follows it; shared code is a package. Message `'<specifier>' resolves outside the project; check reads only its files`, the specifier cut from its front to fit 89 units (59 without it); no fix."
// k.boundary, Rules "E1015 a relative specifier resolving outside the project (Following; fix: none)."
// Spec: k.boundary, clause "`import { x } from '../../../shared/x.ts'` in `modules/a/Page.tsx`, resolving to a file outside the project root, is one E1015 at the specifier's opening quote with no fix; the same import in `modules/a/a.test.ts`, and `import { y } from '../b/y.ts'` resolving inside the project, are none."
// Seed 1337 (the properties below). The type pass is off: the rule reads syntax and paths, and the target of an outside specifier is never on disk.
// Reading: the diagnostic sits at the specifier's opening quote, as E1013's does (k.bundle Aliases).
// Reading: from `modules/a/Page.tsx` the specifier `'../../../shared/x.ts'` resolves to `<root>/../shared/x.ts`, outside the root; the property ranges over the depth.
// Reading: a test file is one named `*.test.ts` or `*.test.tsx`.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const e1015 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1015");
const TAIL = "' resolves outside the project; check reads only its files";

describe("k.boundary Following: E1015 is a relative specifier in a non-test project code file resolving outside the project root", () => {
  test("`import { x } from '../../../shared/x.ts'` in `modules/a/Page.tsx`, resolving to a file outside the project root, is one E1015 at the specifier's opening quote with no fix; the same import in `modules/a/a.test.ts`, and `import { y } from '../b/y.ts'` resolving inside the project, are none.", () => {
    const outside = "import { x } from '../../../shared/x.ts'\nexport const Page = x\n";
    const ds = e1015([f("modules/a/Page.tsx", outside)]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/Page.tsx");
    expect(ds[0]?.line).toBe(1);
    expect(ds[0]?.col).toBe(outside.indexOf("'") + 1);
    expect(ds[0]?.fix).toBeUndefined();
    expect(e1015([f("modules/a/a.test.ts", outside)])).toEqual([]);
    expect(
      e1015([
        f("modules/a/Page.tsx", "import { y } from '../b/y.ts'\nexport const Page = y\n"),
        f("modules/b/y.ts", "export const y = 1\n"),
      ]),
    ).toEqual([]);
  });

  test("the message is `'<specifier>' resolves outside the project; check reads only its files`, 59 units without the specifier", () => {
    expect(`'${TAIL}`.length).toBe(59);
    const ds = e1015([f("modules/a/Page.tsx", "import { x } from '../../../shared/x.ts'\nexport const Page = x\n")]);
    expect(ds.map((d) => d.message)).toEqual([`'../../../shared/x.ts${TAIL}`]);
  });

  test("property: a relative specifier of `..` segments from a file `d` folders deep is E1015 exactly when it climbs more than `d` folders, for each way to write one", () => {
    const form = fc.constantFrom(
      (s: string) => `import { x } from '${s}'\nexport const a = x\n`,
      (s: string) => `import type { x } from '${s}'\nexport type A = typeof x\n`,
      (s: string) => `export { x } from '${s}'\n`,
      (s: string) => `export * from '${s}'\n`,
      (s: string) => `import '${s}'\n`,
      (s: string) => `export const load = () => import('${s}')\n`,
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 6 }),
        form,
        fc.constantFrom("", "./", "./sub/../"),
        fc.constantFrom("", "?raw"),
        (depth, climb, write, lead, query) => {
          const folders = Array.from({ length: depth }, (_, i) => `d${i}`);
          const path = `${[...folders, "File"].join("/")}.ts`;
          const spec = `${lead}${"../".repeat(climb)}target.ts${query}`;
          const ds = e1015([f(path, write(spec))]);
          const outside = climb > depth;
          expect(ds).toHaveLength(outside ? 1 : 0);
          if (outside) {
            expect(ds[0]?.message.endsWith(TAIL)).toBe(true);
            expect(ds[0]?.message.length).toBeLessThanOrEqual(89);
            expect(ds[0]?.fix).toBeUndefined();
          }
        },
      ),
      { seed: SEED, numRuns: 120 },
    );
  });

  test("a test file (`*.test.ts`, `*.test.tsx`) at any depth is exempt, and a non-test file beside it is not", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.constantFrom("test.ts", "test.tsx"), (depth, ext) => {
        const dirs = Array.from({ length: depth }, (_, i) => `d${i}/`).join("");
        const src = `import { x } from '${"../".repeat(depth + 1)}out.ts'\nexport const a = x\n`;
        expect(e1015([f(`${dirs}a.${ext}`, src)])).toEqual([]);
        expect(e1015([f(`${dirs}a.ts`, src)])).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("the specifier is cut from its front to fit 89 units, and the message ends with the stated tail", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (n) => {
        const spec = `../../../${Array.from({ length: n }, (_, i) => `segment${i}`).join("/")}/x.ts`;
        const ds = e1015([f("modules/a/Page.tsx", `import { x } from '${spec}'\nexport const a = x\n`)]);
        expect(ds).toHaveLength(1);
        const m = ds[0]?.message ?? "";
        expect(m.length).toBeLessThanOrEqual(89);
        expect(m.endsWith(TAIL)).toBe(true);
        if (spec.length + 59 <= 89) expect(m).toBe(`'${spec}${TAIL}`);
        else expect(m).toContain("x.ts");
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("a package specifier is not E1015", () => {
    const src = "import a from 'some-pkg/a.ts'\nimport b from '@keel/schema'\nexport const x = [a, b]\n";
    expect(e1015([f("modules/a/Page.tsx", src)])).toEqual([]);
  });
});
