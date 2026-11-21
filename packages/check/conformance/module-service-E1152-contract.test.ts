// Spec: k.module Rules: E1152 "import from a module not in `deps`" and, k.contract, "importing the contract needs `deps` only (E1152), never `public.exports`." Seed 1337.
// Spec: k.contract, clause "Module `b` importing `modules/a/a.contract.ts` without `a` in `deps` is one E1152; with it none, and no E1151."
// A caller reaches another module's API through `service({ contract })` over that module's contract file (k.services).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, codesOf, contractFile, has, lowerId, manifestFile } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, lowerId).filter(([a, b, name]) => a !== b && a !== name && b !== name);

const apiContract = (b: string, name: string) => ({
  path: `modules/${b}/${b}.contract.ts`,
  source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const ${b} = contract('${b}', { '${b}.${name}': { method: 'GET', path: '/${b}/${name}', output: s.json() } })\n`,
});
const caller = (a: string, b: string) => ({
  path: `modules/${a}/api.ts`,
  source: `import { service } from '@keel/services'\nimport { ${b} } from '../${b}/${b}.contract.ts'\nexport const api = service({ contract: ${b} })\n`,
});
const mk = (a: string, b: string, name: string, deps: string[]) => [
  manifestFile({ id: b }),
  apiContract(b, name),
  manifestFile({ id: a, deps }),
  caller(a, b),
];

describe("k.module: service({ contract }) access", () => {
  test("E1152 a `service({ contract })` over the contract of a module not in `deps` is reported at the import (fix adds it)", () => {
    fc.assert(
      fc.property(distinct, ([a, b, name]) => {
        const d = codesOf(mk(a, b, name, []), "E1152");
        expect(d.length).toBeGreaterThanOrEqual(1);
        expect(d[0]?.path).toBe(`modules/${a}/api.ts`);
        expect(has(mk(a, b, name, [b]), "E1152")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("with the serving module in `deps`, importing its contract reports no E1151 although `public.exports` omits it", () => {
    fc.assert(
      fc.property(distinct, ([a, b, name]) => {
        expect(has(mk(a, b, name, [b]), "E1151")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a page-only contract imported for links needs `deps` only: absent is one E1152, listed is none and no E1151", () => {
    fc.assert(
      fc.property(distinct, ([a, b, name]) => {
        const files = (deps: string[]) => [
          manifestFile({ id: b }),
          contractFile(b, [`${b}.${name}`]),
          manifestFile({ id: a, deps }),
          {
            path: `modules/${a}/Back.ts`,
            source: `import { ${b} } from '../${b}/${b}.contract.ts'\nexport const Back = ${b}.href('${b}.${name}')\n`,
          },
        ];
        expect(codesOf(files([]), "E1152")).toHaveLength(1);
        expect(has(files([b]), "E1152")).toBe(false);
        expect(has(files([b]), "E1151")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
