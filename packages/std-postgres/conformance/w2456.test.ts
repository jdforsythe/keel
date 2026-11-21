// Spec: std.postgres, Rules "W2456 `now()`, `current_timestamp`, `clock_timestamp()`, `random()` or `gen_random_uuid()` in a template's text or a migration, not replayed under sim (pass `ctx.clock.now()` or `ctx.random.id(brand)`)"
// Spec: std.postgres, Conformance "E2451, E2452, E2458 and W2456 each fire on a fixture, not on its clean twin; a missing `KEEL_POSTGRES_URL` is E2455."
// Seed: 1337.
// A migration is an entry `{ path: "modules/<id>/migrations/NNNN-<kebab>.sql", source: <sql text> }` of the same `check(files)` array, and a rule reads it like a `.ts` entry (`path`, `source`), reporting W2456 once per occurrence.
// Assumption: one warning per occurrence; a `sql` template's text is the literal parts of the tagged template; a migration is a `.sql` file under the module.
import fc from "fast-check";
import { expect, test } from "vitest";
import { dbFile, found, project } from "./rules-fixtures.ts";

const SEED = 1337;
const P = "modules/kitchen/kitchenDb.server.ts";
const CALLS = ["now()", "current_timestamp", "clock_timestamp()", "random()", "gen_random_uuid()"];
const withQuery = (expr: string) =>
  dbFile(
    '"kitchen.db"',
    `import { sql } from "@keel/std-postgres"\nimport { s } from "@keel/schema"\nexport const q = sql(s.object({ v: s.string() }))\`select ${expr} as v\`\n`,
  );

test("W2456 fires on each of its five SQL calls in a template's text, not on the clean twin passing a parameter", () => {
  for (const c of CALLS) {
    expect(found(project(P, withQuery(c)), "W2456").length).toBe(1);
  }
  expect(found(project(P, withQuery("${1}")), "W2456").length).toBe(0);
});

test("W2456 fires on each of its five SQL calls in a migration, not on a clean migration", () => {
  fc.assert(
    fc.property(fc.constantFrom(...CALLS), (c) => {
      const dirty = project(P, dbFile('"kitchen.db"'), "node", `create table t (at timestamptz default ${c})`);
      expect(found(dirty, "W2456").length).toBe(1);
      expect(found(project(P, dbFile('"kitchen.db"')), "W2456").length).toBe(0);
    }),
    { seed: SEED, numRuns: 15 },
  );
});
