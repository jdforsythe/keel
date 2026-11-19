// Spec: std.brands, clause "The main entry `@keel/std-brands` exports nothing and `@keel/std-brands/tools` exports exactly `idBrandCase`; the package's `exports` has the keys `.` and `./tools`."
// Seed 1337 (no random inputs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");

test("The main entry `@keel/std-brands` exports nothing and `@keel/std-brands/tools` exports exactly `idBrandCase`; the package's `exports` has the keys `.` and `./tools`.", async () => {
  const main = await import("@keel/std-brands");
  expect(Object.keys(main)).toEqual([]);
  const tools = await import("@keel/std-brands/tools");
  expect(Object.keys(tools)).toEqual(["idBrandCase"]);
  const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exp: unknown = Reflect.get(Object(pkg), "exports");
  expect(Object.keys(Object(exp)).sort()).toEqual([".", "./tools"]);
});
