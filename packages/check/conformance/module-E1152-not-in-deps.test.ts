// Spec: k.module, clause "Importing from a module absent from `deps` reports E1152 even when the export is public."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  SEED,
  codesOf,
  exportFile,
  has,
  importer,
  lowerId,
  manifestFile,
  pascal,
  routesFile,
} from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, pascal).filter(([a, b]) => a !== b);

test("importing from a module absent from deps reports E1152 even when the export is public", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub]) => {
      const files = [
        manifestFile({ id: b, exports: [pub] }),
        exportFile(`modules/${b}`, pub),
        manifestFile({ id: a, deps: [] }),
        importer(a, b, pub),
      ];
      const d = codesOf(files, "E1152");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${a}/OrderCard.ts`);
      expect(has(files, "E1151")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1152: listing the module in deps clears it", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub]) => {
      const files = [
        manifestFile({ id: b, exports: [pub] }),
        exportFile(`modules/${b}`, pub),
        manifestFile({ id: a, deps: [b] }),
        importer(a, b, pub),
      ];
      expect(has(files, "E1152")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1152: routes.href() into a module not in deps is reported", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const route = `${b}.show`;
      const mk = (deps: string[]) => [
        manifestFile({ id: b, exports: ["routes"], routes: [route] }),
        routesFile(b, [route]),
        manifestFile({ id: a, deps }),
        {
          path: `modules/${a}/Back.ts`,
          source: `import { routes } from '../${b}/routes.ts'\nexport const Back = routes.href('${route}')\n`,
        },
      ];
      expect(has(mk([]), "E1152")).toBe(true);
      expect(has(mk([b]), "E1152")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
