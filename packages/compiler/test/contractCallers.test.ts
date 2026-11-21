// contractCallers (k.compat Surface `callers`): the modules that value-import each app module's contract. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contractCallers } from "../src/contractCallers.ts";

const contract = (id: string) => ({
  path: `modules/${id}/${id}.contract.ts`,
  source: `import { contract } from "@keel/router/contract";\nexport const ${id} = contract("${id}", {});\n`,
});

describe("contractCallers", () => {
  it("names each importing module once, sorted, and never the contract's own module", () => {
    const files = [
      contract("y"),
      { path: "modules/b/api.ts", source: 'import { y } from "../y/y.contract.ts";\nexport const a = y;\n' },
      { path: "modules/a/deep/api.ts", source: 'import { y } from "../../y/y.contract";\nexport const a = y;\n' },
      { path: "modules/a/other.ts", source: 'export { y } from "../y/y.contract.ts";\n' },
      { path: "modules/y/routes.ts", source: 'import { y } from "./y.contract.ts";\nexport const r = y;\n' },
    ];
    expect(contractCallers(files)).toEqual({ y: ["a", "b"] });
  });

  it("ignores a type-only import, a file outside modules, another file name, and a file that does not parse", () => {
    const files = [
      contract("y"),
      { path: "modules/a/t.ts", source: 'import type { y } from "../y/y.contract.ts";\nexport type T = typeof y;\n' },
      { path: "lib/x.ts", source: 'import { y } from "../modules/y/y.contract.ts";\n' },
      { path: "modules/b/x.ts", source: 'import { z } from "../y/z.contract.ts";\n' },
      { path: "modules/c/x.ts", source: 'import { y } from "../y/y.contract.ts";\nexport const = ;\n' },
    ];
    expect(contractCallers(files)).toEqual({});
  });

  it("property: the callers of y are exactly the other modules that import its contract", () => {
    const id = fc.stringMatching(/^[a-x][a-z]{0,4}$/);
    fc.assert(
      fc.property(fc.uniqueArray(id, { maxLength: 6 }), fc.uniqueArray(id, { maxLength: 6 }), (importers, others) => {
        const files = [
          contract("y"),
          ...importers.map((m) => ({ path: `modules/${m}/a.ts`, source: 'import { y } from "../y/y.contract.ts";\n' })),
          ...others.map((m) => ({ path: `modules/${m}/b.ts`, source: "export const b = 1;\n" })),
        ];
        const want = [...importers].sort();
        expect(contractCallers(files)).toEqual(want.length === 0 ? {} : { y: want });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
