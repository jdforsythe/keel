import { check } from "@keel/check";
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, exportFile, importer, manifestFile, contractFile, bindingFile } from "./module-support.ts";

const tree = [
  manifestFile({ id: "catalog", exports: ["Item", "Ghost"] }),
  exportFile("modules/catalog", "Item"),
  exportFile("modules/catalog", "Secret"),
  contractFile("catalog", ["catalog.show"]),
  bindingFile("catalog", ["catalog.show"]),
  manifestFile({ id: "orders", deps: ["catalog", "ghosts"], capabilities: [] }),
  importer("orders", "catalog", "Secret"),
  manifestFile({ id: "ghosts", deps: ["orders"] }),
];

test("module checks: two runs on an unchanged tree produce identical diagnostics", () => {
  expect(check(tree, {})).toEqual(check(tree, {}));
});

test("module checks: the order of the input files does not change the diagnostics", () => {
  fc.assert(
    fc.property(fc.shuffledSubarray(tree, { minLength: tree.length, maxLength: tree.length }), (files) => {
      expect(check(files, {}).diagnostics).toEqual(check(tree, {}).diagnostics);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
