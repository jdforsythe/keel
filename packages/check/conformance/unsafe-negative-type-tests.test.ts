// Spec: k.unsafe, clause "In `test/a.test-d.ts`, `// @ts-expect-error a number is no string` above `export const n: string = 1` gives `keel check` no diagnostic; with the line `export const n: string = \"a\"` instead, one E1751 whose message starts `TS2578`."
// Spec: k.unsafe, clause "In `test/a.test-d.ts`, `// @ts-expect-error` with nothing after it, `// @ts-ignore a number is no string`, `x as T`, `x!` and `let v: any` are one E1757 each; in `test/a.test.ts`, `// @ts-expect-error a number is no string` is one E1757."
// Spec: k.unsafe, clause "In `test/a.test-d.tsx`, `{/* @ts-expect-error text is no child of Match */}` is no E1757."
// Spec: k.unsafe, clause "`modules/m/a.test-d.ts` and `modules/m/unsafe/a.test-d.ts` are one E1761 each at line 1; `modules/m/test/a.test-d.ts` and `test/a.test-d.ts` are none; `import \"./a.test-d.ts\"` in `test/b.test.ts` is one E1761 at the specifier; `unsafe(\"one two three four five six seven eight\", () => 1)` in `test/a.test-d.ts` is one E1761 at the call."
// k.unsafe, Rules "E1760 an `unsafe(` justification string of fewer than 8 words, at the string · E1761 a `*.test-d.ts` or `*.test-d.tsx` file not under a `test/` or `conformance/` folder (at its first line), an `import`, `export ... from` or `import()` naming one, at the specifier, or an `unsafe(` call in one, at the call. In this repository `tooling/structure-lint.mjs` reports S0014: an `unsafe(` call in a file of `packages/*` whose lifted range holds no finding E1757 makes. None carries a fix."
// Seed 1337 (every property below). Fixtures are source text over in-memory file maps; the `unsafe` call is built from
// a constant so this file's own source holds no literal call, only fixture text does. Directive text is built from
// constants for the same reason. The type pass is off except where TS2578 is the claim.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const U = "unsafe";
const EXPECT = `@ts-${"expect-error"}`;
const IGNORE = `@ts-${"ignore"}`;
const NOCHECK = `@ts-${"nocheck"}`;
type Diags = ReturnType<typeof check>["diagnostics"];
const run = (path: string, source: string, types = false): Diags => check([{ path, source }], { types }).diagnostics;
const codes = (ds: Diags): string[] => ds.map((d) => d.code);
const of = (ds: Diags, code: string): Diags => ds.filter((d) => d.code === code);

/** A description: a letter first, then letters and spaces. */
const description = fc.stringMatching(/^[a-z][a-z ]{0,30}$/);
const ident = fc
  .stringMatching(/^[a-z]{3,8}$/)
  .filter((n) => !["declare", "function", "const", "export", "type", "let", "var"].includes(n));

describe("k.unsafe Negative type tests: an expectation with a description", () => {
  test("In `test/a.test-d.ts`, `// @ts-expect-error a number is no string` above `export const n: string = 1` gives `keel check` no diagnostic", () => {
    expect(run("test/a.test-d.ts", `// ${EXPECT} a number is no string\nexport const n: string = 1\n`, true)).toEqual(
      [],
    );
  });

  test('with the line `export const n: string = "a"` instead, one E1751 whose message starts `TS2578`', () => {
    const ds = run("test/a.test-d.ts", `// ${EXPECT} a number is no string\nexport const n: string = "a"\n`, true);
    expect(codes(ds)).toEqual(["E1751"]);
    expect(ds[0]?.message.startsWith("TS2578")).toBe(true);
  });

  test("property: for any description holding a letter, the expectation above a failing line is no diagnostic, and above a compiling line is one E1751 starting `TS2578`", () => {
    fc.assert(
      fc.property(description, ident, (why, name) => {
        const failing = `// ${EXPECT} ${why}\nexport const ${name}: string = 1\n`;
        expect(run("test/a.test-d.ts", failing, true)).toEqual([]);
        const compiling = `// ${EXPECT} ${why}\nexport const ${name}: string = "a"\n`;
        const ds = run("test/a.test-d.ts", compiling, true);
        expect(codes(ds)).toEqual(["E1751"]);
        expect(ds[0]?.message.startsWith("TS2578")).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("property: leading white space before the directive and any run of white space before the description keep the expectation no E1757", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[ \t]{0,4}$/),
        fc.stringMatching(/^[ \t]{1,4}$/),
        description,
        (lead, gap, why) => {
          const src = `//${lead}${EXPECT}${gap}${why}\nexport const n: string = 1\n`;
          expect(of(run("test/a.test-d.ts", src), "E1757")).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("k.unsafe Negative type tests: what stays E1757", () => {
  const FORMS: readonly (readonly [string, string])[] = [
    ["`// @ts-expect-error` with nothing after it", `// ${EXPECT}\nexport const n: string = 1\n`],
    ["`// @ts-ignore a number is no string`", `// ${IGNORE} a number is no string\nexport const n: string = 1\n`],
    ["`// @ts-nocheck`", `// ${NOCHECK}\nexport const n: string = 1\n`],
    ["`x as T`", `declare const x: unknown\ntype T = string\nexport const y = x as T\n`],
    ["`x!`", `declare const x: string | undefined\nexport const y = x!\n`],
    ["`let v: any`", `export let v: any = 1\n`],
  ];

  for (const [name, src] of FORMS)
    test(`In \`test/a.test-d.ts\`, ${name} is one E1757`, () => {
      expect(of(run("test/a.test-d.ts", src), "E1757")).toHaveLength(1);
    });

  test("In `test/a.test.ts`, `// @ts-expect-error a number is no string` is one E1757", () => {
    const src = `// ${EXPECT} a number is no string\nexport const n: string = 1\n`;
    expect(of(run("test/a.test.ts", src), "E1757")).toHaveLength(1);
  });

  test("property: a described expectation is one E1757 in any test file that is not a negative type test, and none in one that is", () => {
    const outside = fc.constantFrom(
      "test/a.test.ts",
      "conformance/a.test.ts",
      "modules/m/test/a.test.ts",
      "modules/m/a.test.ts",
      "test/a.spec.ts",
      "test/a.ts",
      "test/a.test.tsx",
    );
    const inside = fc.constantFrom(
      "test/a.test-d.ts",
      "conformance/a.test-d.ts",
      "modules/m/test/a.test-d.ts",
      "packages/p/conformance/a.test-d.ts",
    );
    fc.assert(
      fc.property(description, outside, inside, (why, out, inn) => {
        const src = `// ${EXPECT} ${why}\nexport const n: string = 1\n`;
        expect(of(run(out, src), "E1757")).toHaveLength(1);
        expect(of(run(inn, src), "E1757")).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("property: a bare directive and a directive whose description holds no letter are each one E1757 in a negative type test", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9 ._-]{0,8}$/), (rest) => {
        const src = `// ${EXPECT}${rest === "" ? "" : ` ${rest}`}\nexport const n: string = 1\n`;
        expect(of(run("test/a.test-d.ts", src), "E1757")).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.unsafe Negative type tests: JSX", () => {
  test("In `test/a.test-d.tsx`, `{/* @ts-expect-error text is no child of Match */}` is no E1757", () => {
    const src = `declare const Match: (p: { children?: unknown }) => unknown\nexport const n = <Match>{/* ${EXPECT} text is no child of Match */}</Match>\n`;
    expect(of(run("test/a.test-d.tsx", src), "E1757")).toEqual([]);
  });
});

describe("k.unsafe Rules: E1761", () => {
  const SRC = `export const n: string = "a"\n`;
  const at1 = (path: string): Diags => of(run(path, SRC), "E1761");

  test("`modules/m/a.test-d.ts` and `modules/m/unsafe/a.test-d.ts` are one E1761 each at line 1", () => {
    for (const path of ["modules/m/a.test-d.ts", "modules/m/unsafe/a.test-d.ts"]) {
      const d = at1(path);
      expect(d).toHaveLength(1);
      expect(d[0]?.line).toBe(1);
    }
  });

  test("`modules/m/test/a.test-d.ts` and `test/a.test-d.ts` are none", () => {
    for (const path of ["modules/m/test/a.test-d.ts", "test/a.test-d.ts"]) expect(at1(path)).toEqual([]);
  });

  test("property: a `*.test-d.ts` or `*.test-d.tsx` file is one E1761 at line 1 unless a `test/` or `conformance/` folder holds it", () => {
    const stem = fc.stringMatching(/^[a-z]{1,8}$/);
    const ext = fc.constantFrom("ts", "tsx");
    const bad = fc.constantFrom("", "src/", "modules/m/", "modules/m/unsafe/", "packages/p/src/", "lib/", "apps/a/");
    const good = fc.constantFrom(
      "test/",
      "conformance/",
      "modules/m/test/",
      "packages/p/conformance/",
      "packages/p/test/",
    );
    fc.assert(
      fc.property(stem, ext, bad, good, (name, e, b, g) => {
        const here = of(run(`${b}${name}.test-d.${e}`, SRC), "E1761");
        expect(here).toHaveLength(1);
        expect(here[0]?.line).toBe(1);
        expect(of(run(`${g}${name}.test-d.${e}`, SRC), "E1761")).toEqual([]);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test('`import "./a.test-d.ts"` in `test/b.test.ts` is one E1761 at the specifier', () => {
    const target = { path: "test/a.test-d.ts", source: SRC };
    const src = `import "./a.test-d.ts"\nexport const b = 1\n`;
    const ds = of(check([target, { path: "test/b.test.ts", source: src }], { types: false }).diagnostics, "E1761");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("test/b.test.ts");
    expect(ds[0]?.line).toBe(1);
    const col = src.indexOf('"./a.test-d.ts"') + 1;
    expect(ds[0]?.col).toBeGreaterThanOrEqual(col);
    expect(ds[0]?.col).toBeLessThan(col + '"./a.test-d.ts"'.length);
  });

  test("property: an `import`, an `export ... from` and an `import()` naming a negative type test are each one E1761 at the specifier", () => {
    const forms = (spec: string): readonly string[] => [
      `import "${spec}"\n`,
      `import { n } from "${spec}"\nexport const m = n\n`,
      `export { n } from "${spec}"\n`,
      `export const m = import("${spec}")\n`,
    ];
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,8}$/), fc.constantFrom("ts", "tsx"), (stem, e) => {
        const spec = `./${stem}.test-d.${e}`;
        for (const src of forms(spec)) {
          const files = [
            { path: `test/${stem}.test-d.${e}`, source: `export const n = 1\n` },
            { path: "test/b.test.ts", source: src },
          ];
          const ds = of(check(files, { types: false }).diagnostics, "E1761");
          expect(ds, src).toHaveLength(1);
          expect(ds[0]?.line, src).toBe(src.split("\n").findIndex((l) => l.includes(spec)) + 1);
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("an import of a file that is not a negative type test is no E1761", () => {
    const files = [
      { path: "test/a.ts", source: `export const n = 1\n` },
      { path: "test/b.test.ts", source: `import "./a.ts"\nexport const b = 1\n` },
    ];
    expect(of(check(files, { types: false }).diagnostics, "E1761")).toEqual([]);
  });

  test(`\`${U}("one two three four five six seven eight", () => 1)\` in \`test/a.test-d.ts\` is one E1761 at the call`, () => {
    const call = `${U}("one two three four five six seven eight", () => 1)`;
    const src = `declare function ${U}<V>(reason: string, fn: () => V): V\nexport const n = ${call}\n`;
    const ds = run("test/a.test-d.ts", src);
    expect(of(ds, "E1761")).toHaveLength(1);
    expect(of(ds, "E1760")).toEqual([]);
    expect(of(ds, "E1761")[0]?.line).toBe(2);
    expect(of(ds, "E1761")[0]?.col).toBe((src.split("\n")[1] ?? "").indexOf(call) + 1);
  });

  test("E1761 carries no fix", () => {
    const ds = run("modules/m/a.test-d.ts", SRC);
    expect(of(ds, "E1761").length).toBeGreaterThan(0);
    for (const d of of(ds, "E1761")) expect(d.fix).toBeUndefined();
  });
});
