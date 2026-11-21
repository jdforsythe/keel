// Spec: std.health, clause "`check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1156."
// Seed 1337. E1157 is retired (RFC 0157); the spec range is E1151-E1156.
import { expect, test } from "vitest";
import { moduleCodes, packageFiles } from "./support.ts";

test("`check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1156", () => {
  const files = packageFiles();
  expect(files.length).toBeGreaterThan(1);
  expect(moduleCodes(files)).toEqual([]);
});
