// Spec: std.health, clause "`check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1157."
// Seed 1337
import { expect, test } from "vitest";
import { moduleCodes, packageFiles } from "./support.ts";

test("`check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1157", () => {
  const files = packageFiles();
  expect(files.length).toBeGreaterThan(1);
  expect(moduleCodes(files)).toEqual([]);
});
