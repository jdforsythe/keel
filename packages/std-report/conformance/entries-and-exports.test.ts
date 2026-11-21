// Spec: std.report, clause "`@keel/std-report` exports exactly `Tally` and `tallyOf`, and `@keel/std-report/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`."
// Seed 1337 (no random inputs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");

test("`@keel/std-report` exports exactly `Tally` and `tallyOf`, and `@keel/std-report/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.", async () => {
  const main = await import("@keel/std-report");
  expect(Object.keys(main).sort()).toEqual(["Tally", "tallyOf"]);
  const tools = await import("@keel/std-report/tools");
  expect(Object.keys(tools)).toEqual([]);
  const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exp: unknown = Reflect.get(Object(pkg), "exports");
  expect(Object.keys(Object(exp)).sort()).toEqual([".", "./tools"]);
});
