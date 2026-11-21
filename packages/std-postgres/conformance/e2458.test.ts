// Spec: std.postgres, Rules "E2458 a `database` name that is not a literal `<moduleId>.<name>` of its module (E1607)"
// Spec: std.postgres, Conformance "E2451, E2452, E2458 and W2456 each fire on a fixture, not on its clean twin" (E2458 here).
// Seed: 1337.
// Assumption: as for E1607 (k.data), `<name>` is one lowerCamel segment and the rule reports once per bad call.
// Skipped until `@keel/std-postgres` exists.
import fc from "fast-check";
import { expect, test } from "vitest";
import { dbFile, found, project } from "./rules-fixtures.ts";

const SEED = 1337;
const P = "modules/kitchen/kitchenDb.server.ts";

test.skip("E2458 fires on `database('db')`, `database('other.db')`, `database('kitchen.Db')` and `database(name)`, not on `database('kitchen.db')`", () => {
  expect(found(project(P, dbFile('"kitchen.db"')), "E2458").length).toBe(0);
  for (const bad of ['"db"', '"other.db"', '"kitchen.Db"', '"kitchen.a.b"']) {
    expect(found(project(P, dbFile(bad)), "E2458").length).toBe(1);
  }
  expect(found(project(P, dbFile("name", 'const name = "kitchen.db"\n')), "E2458").length).toBe(1);
});

test.skip("E2458 does not fire for any literal `kitchen.<lowerCamel>`", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,9}$/), (n) => {
      expect(found(project(P, dbFile(`"kitchen.${n}"`)), "E2458").length).toBe(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
