// Spec: std.postgres, Conformance "On a `pglite:` folder, a migration referencing a table that does not exist rejects the first `query` with its error; once another database on that folder makes the table, the next `query` on the same ctx applies the migration and answers."
// Spec: std.postgres, Migrations "a failed pass keeps nothing ... Any other failure rejects that call. The next call, on that ctx or another, runs the pass again."
// Seed: 1337 (the inserted value is generated).
// Assumption: database `a` (migration `insert into T values (v)`, T absent) and database `b` (migration `create table T (n int)`) share one `pglite:<folder>` and one real ctx; `fresh()` names both and T, so a shared Postgres is untouched.
// Assumption: the rejection is a thrown error (not a `Result`) because "any other failure rejects that call".
// Pending: a failed pass poisons the ctx today.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { FOLDER_BOUND, SEED, fresh, migrationsOf, okOf, sqlName } from "./fixtures.ts";

const before = process.env.KEEL_POSTGRES_URL;
afterEach(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
});
const Count = s.object({ c: s.number() });

/** Generated values the case runs: one PGlite folder a run. */
const RUNS = 3;

test("a migration referencing a table that does not exist rejects the first `query` with its error; once another database on that folder makes the table, the next `query` on the same ctx applies the migration and answers", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (v) => {
      const dir = mkdtempSync(join(tmpdir(), "keel-pg-"));
      try {
        const a = fresh();
        const b = fresh();
        const T = sqlName(b.table);
        process.env.KEEL_POSTGRES_URL = `pglite:${dir}`;
        const dbA = database(a.cap, { migrations: migrationsOf(`insert into ${b.table} values (${v})`) });
        const dbB = database(b.cap, { migrations: migrationsOf(`create table ${b.table} (n int)`) });
        const ctx = createCtx({ mode: "real", seed: SEED });
        const q = sql(Count)`select coalesce(sum(n), 0)::int as c from ${T}`;
        await expect(dbA(ctx).query(q)).rejects.toThrow(/does not exist/);
        expect(okOf(await dbB(ctx).query(q))[0]?.c).toBeTypeOf("number");
        expect(okOf(await dbA(ctx).query(q))[0]?.c).toBe(v);
        expect(okOf(await dbA(ctx).query(q))[0]?.c).toBe(v);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
}, RUNS * FOLDER_BOUND);
