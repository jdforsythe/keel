// Spec: k.aria, Conformance "An app file importing `Part` from `@keel/ui/aria` reports no diagnostic, and its `styles` are collected as a stdlib component's."
// Seed: 1337. The diagnostic half; the collection half is packages/compiler/conformance/part-styles-app-part.test.ts.
// The code E1822 is retired and not reused: no diagnostic of that code is reported for any import of `@keel/ui/aria`.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const importer = (name: string): string => `import { Part } from '@keel/ui/aria'\nexport const ${name} = Part\n`;
const IMPORT = importer("p");
const REEXPORT = "export { Part } from '@keel/ui/aria'\n";
const STAR = "export * from '@keel/ui/aria'\n";
const COMPONENT = `import { Part } from '@keel/ui/aria'
export default function Cell() { return <Part id="c" role="gridcell" p="2">1</Part> }
`;

const diags = (path: string, source: string) => check([{ path, source }], { types: false }).diagnostics;

describe("k.aria: Part is open to app code", () => {
  test("An app file importing `Part` from `@keel/ui/aria` reports no diagnostic", () => {
    expect(diags("modules/a/p.ts", IMPORT)).toEqual([]);
    expect(diags("test/p.test.ts", IMPORT)).toEqual([]);
    expect(diags("modules/a/index.ts", REEXPORT)).toEqual([]);
    expect(diags("modules/a/index.ts", STAR)).toEqual([]);
  });

  test("an app component rendering a `Part` with a style prop reports no diagnostic", () => {
    expect(diags("modules/a/Cell.tsx", COMPONENT)).toEqual([]);
  });

  test("property: an import of `@keel/ui/aria` reports no diagnostic in any app path", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, seg, (dir, base) => {
        const file = `f${base}`;
        const source = importer(file);
        expect(diags(`modules/${dir}/${file}.ts`, source)).toEqual([]);
        expect(diags(`${dir}/${file}.tsx`, source)).toEqual([]);
        expect(diags(`modules/${dir}/unsafe/${file}.ts`, source)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
