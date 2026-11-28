// Spec: std.postgres, clause "`query` parses every row with the schema; a row failing it is `postgres.result`, holding no value; `one` of no row is `keel.notFound`; `run` of a statement returning a row is `postgres.result`."
// std.postgres, API "`one(q)`: the one row; none is `keel.notFound`, more than one throws. `run(q)`: the count of rows changed; `q` is `sql(NoRows)`, which refuses any row."
// std.postgres, API "a row failing its schema is `postgres.result`, data `{ row, issues }` (its index; paths, rules)"
// Seed: 1337.
// Assumption: the accessor's `query`, `one`, `run` return a `Result`; `one` of two rows rejects (the spec says "throws"); run on sim, PGlite and, with KEEL_TEST_POSTGRES_URL, Postgres 17.
// Assumption: `postgres.result` data `row` is the zero-based index of the failing row and `issues` holds `{ path, rule }`; the error and its data hold no row value.
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FOLDER_BOUND, MODES, Row, SEED, errOf, fresh, notesDb, okOf, sqlName } from "./fixtures.ts";

const SECRETISH = fc.stringMatching(/^[a-z]{12,20}$/);
/** Generated inputs each property case runs: on PGlite, one folder a run. */
const RUNS = 5;

for (const m of MODES) {
  describe(m.name, () => {
    test(
      "`query` parses every row with the schema",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uniqueArray(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 0, maxLength: 6 }),
            async (names) => {
              const { cap, table } = fresh();
              const mode = m.make();
              try {
                const db = notesDb(cap, table);
                const ctx = await mode.ctx(cap);
                for (const [i, name] of names.entries()) {
                  expect(
                    okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (${i}, ${name})`)),
                  ).toBe(1);
                }
                const rows = okOf(await db(ctx).query(sql(Row)`select id, name from ${sqlName(table)} order by id`));
                expect(rows).toEqual(names.map((name, id) => ({ id, name })));
              } finally {
                mode.done();
              }
            },
          ),
          { seed: SEED, numRuns: RUNS },
        );
      },
      RUNS * FOLDER_BOUND,
    );

    test(
      "a row failing the schema is `postgres.result`, holding no value",
      async () => {
        await fc.assert(
          fc.asyncProperty(SECRETISH, async (value) => {
            const { cap, table } = fresh();
            const mode = m.make();
            try {
              const db = notesDb(cap, table);
              const ctx = await mode.ctx(cap);
              okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (1, ${value})`));
              const Bad = s.object({ id: s.int(), name: s.int() });
              const e = errOf(await db(ctx).query(sql(Bad)`select id, name from ${sqlName(table)}`));
              if (e.code !== "postgres.result") throw new Error(`expected postgres.result, got ${e.code}`);
              expect(e.data.row).toBe(0);
              expect(e.data.issues.length).toBeGreaterThan(0);
              expect(JSON.stringify(e)).not.toContain(value);
            } finally {
              mode.done();
            }
          }),
          { seed: SEED, numRuns: RUNS },
        );
      },
      RUNS * FOLDER_BOUND,
    );

    test("`one` of no row is `keel.notFound`", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = notesDb(cap, table);
        const ctx = await mode.ctx(cap);
        expect(errOf(await db(ctx).one(sql(Row)`select id, name from ${sqlName(table)} where id = ${1}`)).code).toBe(
          "keel.notFound",
        );
        okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (1, 'a')`));
        expect(okOf(await db(ctx).one(sql(Row)`select id, name from ${sqlName(table)} where id = ${1}`))).toEqual({
          id: 1,
          name: "a",
        });
      } finally {
        mode.done();
      }
    });

    test("`one` of more than one row throws", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = notesDb(cap, table);
        const ctx = await mode.ctx(cap);
        okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (1, 'a'), (2, 'b')`));
        await expect(
          Promise.resolve().then(() => db(ctx).one(sql(Row)`select id, name from ${sqlName(table)}`)),
        ).rejects.toBeDefined();
      } finally {
        mode.done();
      }
    });

    test("`run` of a statement returning a row is `postgres.result`", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = notesDb(cap, table);
        const ctx = await mode.ctx(cap);
        const e = errOf(await db(ctx).run(sql(NoRows)`select 1 as one`));
        expect(e.code).toBe("postgres.result");
      } finally {
        mode.done();
      }
    });
  });
}
