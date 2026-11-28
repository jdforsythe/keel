// Spec: std.postgres-errors, clause "A driver error whose `code` is `08000`, `08001`, `08003`, `08006`, `57P01` or `53300` is `err` `keel.unreachable`; `08007` is `err` `postgres.database` with data `{ sqlstate: '08007' }`; `08004` and `08P01` reject with a value `isDefect(v, 'E2461')` accepts whose `data` is `{ sqlstate }` and whose message is `E2461 std.postgres: the database answered an SQLSTATE no error takes`."
// Seed 1337.
// Gate: runs on PGlite always and on Postgres 17 only with `KEEL_TEST_POSTGRES_URL` (the folder's `MODES`); the driver error is raised by a plpgsql function (`raise exception 'x' using errcode = code`), as database-sqlstate.test.ts does.
// Assumption: "A driver error whose `code` is ..." is observed through `query`, the way a caller sees any database answer; a `Result` for the acted-on codes and a rejection for the defect.
import { isDefect, s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FOLDER_BOUND, MODES, SEED, errOf, fresh, migrationsOf, sqlName } from "./fixtures.ts";

const Value = s.object({ v: s.string() });
const MESSAGE = "E2461 std.postgres: the database answered an SQLSTATE no error takes";

function setup() {
  const { cap, table } = fresh();
  const raiseWith = `${table}_raise_with`;
  const db = database(cap, {
    migrations: migrationsOf(
      `create function ${raiseWith}(code text) returns text language plpgsql as $$ begin raise exception 'x' using errcode = code; end $$`,
    ),
  });
  return { cap, db, raiseWith };
}
const dataOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "data") : undefined);

for (const m of MODES.filter((x) => x.name !== "sim")) {
  describe(m.name, () => {
    test(
      "`08000`, `08001`, `08003`, `08006`, `57P01` and `53300` are `err` `keel.unreachable`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          for (const code of ["08000", "08001", "08003", "08006", "57P01", "53300"]) {
            const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`));
            expect(e.code, code).toBe("keel.unreachable");
          }
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 2,
    );

    test(
      "`08007` is `err` `postgres.database` with data `{ sqlstate: '08007' }`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${"08007"}) as v`));
          expect(e.code).toBe("postgres.database");
          expect(dataOf(e)).toEqual({ sqlstate: "08007" });
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "property: `08004` and `08P01` reject with an E2461 defect whose data is { sqlstate } and whose message names no SQLSTATE",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          await fc.assert(
            fc.asyncProperty(fc.constantFrom("08004", "08P01"), async (code) => {
              const v: unknown = await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`).then(
                () => undefined,
                (e: unknown) => e,
              );
              expect(isDefect(v, "E2461"), code).toBe(true);
              expect(v instanceof Error && v.message, code).toBe(MESSAGE);
              expect(v instanceof Error && Object.getOwnPropertyDescriptor(v, "data")?.value, code).toEqual({
                sqlstate: code,
              });
            }),
            { seed: SEED, numRuns: 6 },
          );
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 2,
    );
  });
}
