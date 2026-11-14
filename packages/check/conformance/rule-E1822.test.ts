// Spec: k.aria, Rules "E1822 `@keel/ui/aria` in app code (no fix: a `@keel/std-headless` widget, or `unsafe/`)."
// Spec: k.aria, Conformance "E1822 fires on an app file importing `@keel/ui/aria` and not on one under `packages/` or `unsafe/`."
// Seed: 1337.
// Scope as E1576 (security-e1576.test.ts): outside `packages/`, `node_modules/` and `.keel/`, tests included; `unsafe/` is also exempt.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const IMPORT = "import { Part } from '@keel/ui/aria'\nexport const p = Part\n";
const REEXPORT = "export { Part } from '@keel/ui/aria'\n";
const STAR = "export * from '@keel/ui/aria'\n";

const codes = (path: string, source: string) =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1822");

describe("k.aria: E1822", () => {
  test("E1822 fires on an app file importing `@keel/ui/aria`", () => {
    expect(codes("modules/a/x.ts", IMPORT)).toHaveLength(1);
  });

  test("E1822 does not fire on a file under `packages/`", () => {
    expect(codes("packages/std-x/src/a.ts", IMPORT)).toEqual([]);
  });

  test("E1822 does not fire on a file under `unsafe/`", () => {
    expect(codes("modules/a/unsafe/x.ts", IMPORT)).toEqual([]);
    expect(codes("unsafe/x.ts", IMPORT)).toEqual([]);
  });

  test("E1822: a re-export of `@keel/ui/aria` is reported", () => {
    expect(codes("modules/a/x.ts", REEXPORT)).toHaveLength(1);
    expect(codes("modules/a/x.ts", STAR)).toHaveLength(1);
  });

  test("E1822: a test file importing `@keel/ui/aria` is reported", () => {
    expect(codes("test/a.test.ts", IMPORT)).toHaveLength(1);
  });

  test("E1822: a file under `node_modules/` or `.keel/` is not reported", () => {
    expect(codes("node_modules/@keel/std-x/a.ts", IMPORT)).toEqual([]);
    expect(codes(".keel/gen/a.ts", IMPORT)).toEqual([]);
  });

  test("E1822: `@keel/ui` and `@keel/ui/css` are not reported", () => {
    expect(codes("modules/a/x.ts", "import { Box } from '@keel/ui'\nexport const b = Box\n")).toEqual([]);
    expect(
      codes("modules/a/x.ts", "import { compileStyles } from '@keel/ui/css'\nexport const c = compileStyles\n"),
    ).toEqual([]);
  });

  test("E1822: carries no fix", () => {
    const [d] = codes("modules/a/x.ts", IMPORT);
    expect(d).toBeDefined();
    expect(d?.fix).toBeUndefined();
  });

  test("property: an import of `@keel/ui/aria` is one E1822 in any app path and none under `packages/`, `node_modules/`, `.keel/` or `unsafe/`", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, seg, (dir, file) => {
        expect(codes(`modules/${dir}/${file}.ts`, IMPORT)).toHaveLength(1);
        expect(codes(`${dir}/${file}.tsx`, IMPORT)).toHaveLength(1);
        expect(codes(`packages/${dir}/src/${file}.ts`, IMPORT)).toEqual([]);
        expect(codes(`node_modules/@keel/${dir}/${file}.ts`, IMPORT)).toEqual([]);
        expect(codes(`.keel/${dir}/${file}.ts`, IMPORT)).toEqual([]);
        expect(codes(`modules/${dir}/unsafe/${file}.ts`, IMPORT)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
