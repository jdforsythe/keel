// Spec: std.postgres, Conformance "On PGlite and on Postgres 17 in CI, `int8`, `jsonb`, `date` and `text[]` columns arrive as the API says."
// Spec: std.postgres, API "Values arrive as JSON values: `bool` as a boolean; `int2`, `int4`, `int8`, `float4`, `float8` as numbers (an `int8` past 2^53 - 1 as its text); `json` and `jsonb` parsed; arrays as arrays; every other type as Postgres's text form (`date` `2026-11-21`)."
// Seed: 1337.
// Assumption: the row schema is `s.json()` per column so the test sees the value the driver decoded, not a schema's reshaping; an `int8` equal to 2^53 - 1 is a number, one past it a string.
// Assumption: Postgres 17 runs when `KEEL_TEST_POSTGRES_URL` is set (MODES); PGlite as sim (in memory) and as `pglite:<folder>`.
// Skipped until `@keel/std-postgres` exists.
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODES, SEED, fresh, migrationsOf, okOf, sqlName } from "./fixtures.ts";

const Any = s.object({ v: s.json() });
const SAFE = Number.MAX_SAFE_INTEGER;

for (const m of MODES) {
  describe(m.name, () => {
    test("`int8` within 2^53 - 1 arrives as a number; past it as its text", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: -SAFE, max: SAFE }), async (n) => {
            const r = okOf(await db(ctx).one(sql(Any)`select ${n}::int8 as v`));
            expect(r.v).toBe(n);
          }),
          { seed: SEED, numRuns: 25 },
        );
        const big = okOf(await db(ctx).one(sql(Any)`select 9007199254740993::int8 as v`));
        expect(big.v).toBe("9007199254740993");
        const neg = okOf(await db(ctx).one(sql(Any)`select (-9007199254740993)::int8 as v`));
        expect(neg.v).toBe("-9007199254740993");
        const edge = okOf(await db(ctx).one(sql(Any)`select 9007199254740991::int8 as v`));
        expect(edge.v).toBe(SAFE);
      } finally {
        mode.done();
      }
    });

    test("`jsonb` and `json` arrive parsed", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        await fc.assert(
          fc.asyncProperty(
            fc.dictionary(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer({ min: -1000, max: 1000 })),
            async (obj) => {
              expect(okOf(await db(ctx).one(sql(Any)`select ${obj}::jsonb as v`)).v).toEqual(obj);
              expect(okOf(await db(ctx).one(sql(Any)`select ${obj}::json as v`)).v).toEqual(obj);
            },
          ),
          { seed: SEED, numRuns: 15 },
        );
      } finally {
        mode.done();
      }
    });

    test("a `date` column arrives as Postgres's text form, `2026-11-21`", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        expect(okOf(await db(ctx).one(sql(Any)`select '2026-11-21'::date as v`)).v).toBe("2026-11-21");
      } finally {
        mode.done();
      }
    });

    test("a `text[]` column arrives as an array of strings", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        await fc.assert(
          fc.asyncProperty(fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 5 }), async (xs) => {
            expect(okOf(await db(ctx).one(sql(Any)`select ${xs}::text[] as v`)).v).toEqual(xs);
          }),
          { seed: SEED, numRuns: 15 },
        );
      } finally {
        mode.done();
      }
    });

    test("`bool` arrives as a boolean, `int2`, `int4`, `float4` and `float8` as numbers, `json` stored in a table column parsed", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, {
          migrations:
            migrationsOf(`create table ${table} (b bool, i2 int2, i4 int4, f4 float4, f8 float8, j jsonb, d date, a text[], i8 int8);
            insert into ${table} values (true, 7, 70000, 1.5, 2.25, '{"k":[1,2]}', '2026-11-21', '{x,y}', 5)`),
        });
        const ctx = await mode.ctx(cap);
        const Cols = s.object({
          b: s.json(),
          i2: s.json(),
          i4: s.json(),
          f4: s.json(),
          f8: s.json(),
          j: s.json(),
          d: s.json(),
          a: s.json(),
          i8: s.json(),
        });
        const row = okOf(await db(ctx).one(sql(Cols)`select * from ${sqlName(table)}`));
        expect(row).toEqual({
          b: true,
          i2: 7,
          i4: 70000,
          f4: 1.5,
          f8: 2.25,
          j: { k: [1, 2] },
          d: "2026-11-21",
          a: ["x", "y"],
          i8: 5,
        });
      } finally {
        mode.done();
      }
    });
  });
}
