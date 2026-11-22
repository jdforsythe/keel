// Spec: std.conflicts, clause "`@keel/std-conflicts` exports exactly the values `RaceRecord`, `findRaces`, `raceRecords` and `races`, and `@keel/std-conflicts/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`."
// Seed 1337 (no random inputs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as main from "@keel/std-conflicts";
import * as tools from "@keel/std-conflicts/tools";
import { expect, test } from "vitest";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");

test("`@keel/std-conflicts` exports exactly the values `RaceRecord`, `findRaces`, `raceRecords` and `races`, and `@keel/std-conflicts/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.", () => {
  expect(Object.keys(main).sort()).toEqual(["RaceRecord", "findRaces", "raceRecords", "races"]);
  expect(Object.keys(tools)).toEqual([]);
  const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exp: unknown = Reflect.get(Object(pkg), "exports");
  expect(Object.keys(Object(exp)).sort()).toEqual([".", "./tools"]);
});
