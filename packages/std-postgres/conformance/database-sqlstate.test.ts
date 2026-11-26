// Spec: std.postgres, clause "On Postgres 17 and on a `pglite:` folder, `run` of `insert into t (v) values ('xyz')`, `t.v` a `varchar(2)` column, is `err` `postgres.database` with data `{ sqlstate: '22001' }` and `query` of `select 'a'::int` with `{ sqlstate: '22P02' }`; inside a `transaction` after `set local statement_timeout = 1`, `select pg_sleep(1)` is `err` `postgres.database` `{ sqlstate: '57014' }`; `select raise_it()`, a function doing `raise exception 'x'`, is `{ sqlstate: 'P0001' }`; no `data` holds more keys than `sqlstate`."
// Spec: std.postgres, clause "`query` of `select * from no_such_table` rejects with a value `isDefect(v, 'E2461')` accepts whose message is `E2461 std.postgres: the database answered SQLSTATE 42P01`."
// std.postgres, Errors "A database error of a class a caller can act on is `postgres.database`, data `{ sqlstate }`, the five-character SQLSTATE and nothing of the error's text: classes `22`, `40` (but the reruns), `53`, `54`, `55`, `57` and `P0` (a statement timeout `57014`, a lock not available `55P03`, a too long value `22001`, the app's own `raise`); `57P01` to `57P03` and class `08` are `keel.unreachable`. Any other SQLSTATE (class `42`: the app's own SQL is wrong; `XX`: the store is) is a bug, a defect E2461."
// std.postgres, Rules "E2461 a database error no error above takes, a defect, message `E2461 std.postgres: the database answered SQLSTATE <sqlstate>`"
// Seed: 1337.
// Gate: runs on PGlite always and on Postgres 17 only with `KEEL_TEST_POSTGRES_URL` (the shared `MODES`, sim left out: sim runs no SQL); no case is skipped by a marker.
// Assumption: the SQLSTATE of the property's cases is raised by a plpgsql function (`raise exception 'x' using errcode = code`), so a class no real statement reaches in a test is still reached; the reruns `40001` and `40P01` raised that way are rerun three times and then `keel.conflict`, as a real serialization failure is.
// Assumption: a lone `query` of an unacted-on database error resolves a `Result` for the classes above, and throws the defect for any other, as for the spec's `no_such_table` clause.
import { isDefect, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FOLDER_BOUND, MODES, SEED, errOf, fresh, migrationsOf, okOf, sqlName } from "./fixtures.ts";

const REAL = MODES.filter((m) => m.name !== "sim");
const Value = s.object({ v: s.string() });
const Sleep = s.object({ pg_sleep: s.string() });

/** A database whose migrations make `raise_it()` and `raise_with(code)`, named per call so files share one server. */
function setup() {
  const { cap, table } = fresh();
  const raiseIt = `${table}_raise_it`;
  const raiseWith = `${table}_raise_with`;
  const short = `${table}_short`;
  const db = database(cap, {
    migrations: migrationsOf(
      `create function ${raiseIt}() returns text language plpgsql as $$ begin raise exception 'x'; end $$`,
      `create function ${raiseWith}(code text) returns text language plpgsql as $$ begin raise exception 'x' using errcode = code; end $$`,
    ),
  });
  return { cap, db, raiseIt, raiseWith, short };
}

/** What a lone `query` of `text` did: a `Result`'s error, its value, or the value it threw. */
type Outcome = { kind: "err"; code: string; data: unknown } | { kind: "ok" } | { kind: "threw"; value: unknown };
const dataOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "data") : undefined);
const codeOf = (e: unknown): string => {
  const c: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
  return typeof c === "string" ? c : "";
};

for (const m of REAL) {
  describe(m.name, () => {
    test(
      "`run` of `insert into t (v) values ('xyz')`, `t.v` a `varchar(2)` column, is `err` `postgres.database` with data `{ sqlstate: '22001' }`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          okOf(await x.db(ctx).run(sql(NoRows)`create table ${sqlName(x.short)} (v varchar(2))`));
          const e = errOf(await x.db(ctx).run(sql(NoRows)`insert into ${sqlName(x.short)} (v) values ('xyz')`));
          expect(e.code).toBe("postgres.database");
          expect(dataOf(e)).toEqual({ sqlstate: "22001" });
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "`query` of `select 'a'::int` is `err` `postgres.database` with data `{ sqlstate: '22P02' }`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const e = errOf(await x.db(ctx).query(sql(Value)`select 'a'::int as v`));
          expect(e.code).toBe("postgres.database");
          expect(dataOf(e)).toEqual({ sqlstate: "22P02" });
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "inside a `transaction` after `set local statement_timeout = 1`, `select pg_sleep(1)` is `err` `postgres.database` `{ sqlstate: '57014' }`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const r = await x.db(ctx).transaction(async (tx) => {
            okOf(await tx.run(sql(NoRows)`set local statement_timeout = 1`));
            return tx.query(sql(Sleep)`select pg_sleep(1) as pg_sleep`);
          });
          const e = errOf(r);
          expect(e.code).toBe("postgres.database");
          expect(dataOf(e)).toEqual({ sqlstate: "57014" });
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "`select raise_it()`, a function doing `raise exception 'x'`, is `err` `postgres.database` `{ sqlstate: 'P0001' }`, and no `data` holds more keys than `sqlstate`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const e = errOf(await x.db(ctx).query(sql(Value)`select ${sqlName(x.raiseIt)}() as v`));
          expect(e.code).toBe("postgres.database");
          expect(dataOf(e)).toEqual({ sqlstate: "P0001" });
          const data = dataOf(e);
          expect(typeof data === "object" && data !== null ? Object.keys(data) : []).toEqual(["sqlstate"]);
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "`query` of `select * from no_such_table` rejects with a value `isDefect(v, 'E2461')` accepts whose message is `E2461 std.postgres: the database answered SQLSTATE 42P01`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const v: unknown = await x
            .db(ctx)
            .query(sql(Value)`select * from no_such_table`)
            .then(
              () => undefined,
              (e: unknown) => e,
            );
          expect(isDefect(v, "E2461")).toBe(true);
          expect(v instanceof Error && v.message).toBe("E2461 std.postgres: the database answered SQLSTATE 42P01");
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    // The classes the Errors bullet lists, each sampled with a SQLSTATE the function raises.
    const sub = fc.constantFrom("0", "1", "2", "3", "4", "5", "9");
    const act = fc
      .oneof(
        fc
          .tuple(fc.constantFrom("22", "53", "54", "55", "57"), sub, sub, sub)
          .map(([c, a, b, d]) => `${c}${a}${b}${d}`),
        fc.tuple(sub, sub, sub).map(([a, b, d]) => `P0${a}${b}${d}`.slice(0, 5)),
        fc.constantFrom("40000", "40002", "40003"),
      )
      .filter((c) => !["57P01", "57P02", "57P03"].includes(c));
    const lost = fc.oneof(
      fc.tuple(sub, sub, sub).map(([a, b, d]) => `08${a}${b}${d}`),
      fc.constantFrom("57P01", "57P02", "57P03"),
    );
    const bug = fc.oneof(
      fc.tuple(fc.constantFrom("42", "XX", "0A", "3D", "28"), sub, sub, sub).map(([c, a, b, d]) => `${c}${a}${b}${d}`),
      fc.constantFrom("42P01", "42601", "42883", "XX000", "XX001", "0A000"),
    );

    test(
      "property: a SQLSTATE of class `22`, `40` (but the reruns), `53`, `54`, `55`, `57` (but `57P01` to `57P03`) or `P0` is `err` `postgres.database` holding that SQLSTATE and nothing else",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const db = x.db(ctx);
          await fc.assert(
            fc.asyncProperty(act, async (code) => {
              const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`));
              expect(e.code, code).toBe("postgres.database");
              expect(dataOf(e), code).toEqual({ sqlstate: code });
            }),
            { seed: SEED, numRuns: 15 },
          );
        } finally {
          mode.done();
        }
      },
      15 * FOLDER_BOUND,
    );

    test(
      "property: a SQLSTATE of class `08`, and `57P01` to `57P03`, is `err` `keel.unreachable`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const db = x.db(ctx);
          await fc.assert(
            fc.asyncProperty(lost, async (code) => {
              const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`));
              expect(e.code, code).toBe("keel.unreachable");
            }),
            { seed: SEED, numRuns: 10 },
          );
        } finally {
          mode.done();
        }
      },
      10 * FOLDER_BOUND,
    );

    test(
      "the reruns `40001` and `40P01` are rerun, and past the third run are `keel.conflict`, not `postgres.database`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          for (const code of ["40001", "40P01"]) {
            const e = errOf(await x.db(ctx).query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`));
            expect(e.code, code).toBe("keel.conflict");
          }
        } finally {
          mode.done();
        }
      },
      2 * FOLDER_BOUND,
    );

    test(
      "property: any other SQLSTATE (class `42`, `XX` and the rest) is a defect E2461 naming the SQLSTATE, no `Result`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const ctx = await mode.ctx(x.cap);
          const db = x.db(ctx);
          await fc.assert(
            fc.asyncProperty(bug, async (code) => {
              const out: Outcome = await db.query(sql(Value)`select ${sqlName(x.raiseWith)}(${code}) as v`).then(
                (r): Outcome => (r.ok ? { kind: "ok" } : { kind: "err", code: codeOf(r.error), data: dataOf(r.error) }),
                (value: unknown): Outcome => ({ kind: "threw", value }),
              );
              expect(out.kind, code).toBe("threw");
              if (out.kind !== "threw") return;
              expect(isDefect(out.value, "E2461"), code).toBe(true);
              expect(out.value instanceof Error && out.value.message, code).toBe(
                `E2461 std.postgres: the database answered SQLSTATE ${code}`,
              );
            }),
            { seed: SEED, numRuns: 15 },
          );
        } finally {
          mode.done();
        }
      },
      15 * FOLDER_BOUND,
    );
  });
}
