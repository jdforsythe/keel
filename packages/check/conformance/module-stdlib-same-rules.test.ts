// Seed 1337
// Fixture assumption: a stdlib module is a package `@keel/std-x` whose manifest sits at
// node_modules/@keel/std-x/module.ts and whose files are imported as `@keel/std-x/<File>`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { has, manifestFile, exportFile, pascal, SEED } from "./module-support.ts";

const PKG = "@keel/std-auth";
const ROOT = "node_modules/@keel/std-auth";
const std = (m: { exports?: string[]; deps?: string[] }) => manifestFile({ id: PKG, ...m }, ROOT);
const app = (deps: string[], name: string) => [
  manifestFile({ id: "orders", deps }),
  {
    path: "modules/orders/OrderCard.ts",
    source: `import { ${name} } from '${PKG}/${name}'\nexport const OrderCard = ${name}\n`,
  },
];

test("a stdlib module's manifest is enforced by the same rules: non-public import is E1151, public is clean", () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const mk = (exports: string[]) => [std({ exports }), exportFile(ROOT, name), ...app([PKG], name)];
      expect(has(mk([]), "E1151")).toBe(true);
      expect(has(mk([name]), "E1151")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a stdlib module's manifest is enforced by the same rules: absent from deps is E1152", () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const files = [std({ exports: [name] }), exportFile(ROOT, name), ...app([], name)];
      expect(has(files, "E1152")).toBe(true);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a stdlib module's manifest is enforced by the same rules: public naming a missing export is E1154", () => {
  fc.assert(
    fc.property(pascal, (name) => {
      expect(has([std({ exports: [name] })], "E1154")).toBe(true);
      expect(has([std({ exports: [name] }), exportFile(ROOT, name)], "E1154")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
