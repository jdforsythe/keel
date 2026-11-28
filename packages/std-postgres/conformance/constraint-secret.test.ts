// Spec: std.postgres, clause "An insert breaking unique index `t_name_key` is `postgres.constraint` with data `{ kind: 'unique' }`, `constraintOf(e, ['x', 't_name_key'])` is `'t_name_key'`, and `constraintOf` of `e` given `['x']`, or of `{ ...e }`, is `undefined`; a `Secret` or `undefined` parameter throws E2457."
// std.postgres, Errors "a unique, foreign key, check or not-null violation is `postgres.constraint`, data `{ kind }`, `kind` `unique`, `foreign`, `check` or `notNull`, and `constraintOf(e, names)` (`/server`) the member of the app's list `names` naming the constraint broken (a not-null violation's column) or `undefined`: a name is never data"
// std.postgres, Rules "E2457 a parameter that is not a JSON value; ... E2457 throw"; API "anything else, a `Secret` too, throws E2457 naming its position."
// Seed: 1337.
// Assumption: E2457 is a thrown error whose `code` is "E2457" or whose message holds it; thrown by the `sql` tag or by the query, so tests await both inside one async function.
// Assumption: "naming its position" is the 1-based number of the parameter (`$N`), shown in the message as its digits.
// Assumption: for foreign and check the tests name constraints explicitly; `t_name_key` is the fixture table's own name plus `_name_key`.
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { constraintOf, database } from "@keel/std-postgres/server";
import type { Database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FOLDER_BOUND, MODES, SEED, errOf, fresh, migrationsOf, notesDb, okOf, sqlName } from "./fixtures.ts";

const e2457 = (e: unknown): boolean =>
  String(Reflect.get(Object(e), "code")) === "E2457" || String(e).includes("E2457");

/** Generated names the unique-index case runs: on PGlite, one folder a run. */
const RUNS = 5;

for (const m of MODES) {
  describe(m.name, () => {
    test(
      "An insert breaking unique index `t_name_key` is `postgres.constraint` with data `{ kind: 'unique' }`, `constraintOf(e, ['x', 't_name_key'])` is `'t_name_key'`, `constraintOf` of `e` given `['x']`, or of `{ ...e }`, is `undefined`, and the error carries no parameter value or name",
      async () => {
        // Values are upper case: the constraint name, table name, code and kind are lower case, so a value never occurs in them by chance.
        await fc.assert(
          fc.asyncProperty(fc.stringMatching(/^[A-Z]{6,12}$/), async (name) => {
            const { cap, table } = fresh();
            const mode = m.make();
            try {
              const db = notesDb(cap, table);
              const ctx = await mode.ctx(cap);
              okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (1, ${name})`));
              const e = errOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(table)} values (2, ${name})`));
              expect(e.code).toBe("postgres.constraint");
              if (e.code !== "postgres.constraint") return;
              const key = `${table}_name_key`;
              expect(e.data).toEqual({ kind: "unique" });
              expect(constraintOf(e, ["x", key])).toBe(key);
              expect(constraintOf(e, ["x"])).toBeUndefined();
              expect(constraintOf({ ...e }, ["x", key])).toBeUndefined();
              expect(JSON.stringify(e)).not.toContain(name);
              expect(JSON.stringify(e)).not.toContain(key);
            } finally {
              mode.done();
            }
          }),
          { seed: SEED, numRuns: RUNS },
        );
      },
      RUNS * FOLDER_BOUND,
    );

    test("a foreign key, check or not-null violation is `postgres.constraint` with data `{ kind }`, `foreign`, `check` or `notNull`, and `constraintOf` names the constraint, or a not-null violation's column, from the app's list", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, {
          migrations: migrationsOf(
            `create table ${table}_p (id int primary key);
             create table ${table} (id int primary key, p int constraint ${table}_fk references ${table}_p (id), n int not null, c int constraint ${table}_ck check (c > 0))`,
          ),
        });
        const ctx = await mode.ctx(cap);
        const T = sqlName(table);
        const names: readonly [string, ...string[]] = [`${table}_fk`, `${table}_ck`, "n"];
        const broken = async (q: Parameters<Database["run"]>[0]) => {
          const e = errOf(await db(ctx).run(q));
          return {
            code: e.code,
            data: e.data,
            name: e.code === "postgres.constraint" ? constraintOf(e, names) : undefined,
          };
        };
        const fk = await broken(sql(NoRows)`insert into ${T} values (1, 99, 1, 1)`);
        expect(fk).toEqual({ code: "postgres.constraint", data: { kind: "foreign" }, name: `${table}_fk` });
        okOf(await db(ctx).run(sql(NoRows)`insert into ${sqlName(`${table}_p`)} values (1)`));
        const ck = await broken(sql(NoRows)`insert into ${T} values (1, 1, 1, 0)`);
        expect(ck).toEqual({ code: "postgres.constraint", data: { kind: "check" }, name: `${table}_ck` });
        const nn = await broken(sql(NoRows)`insert into ${T} values (1, 1, null, 1)`);
        expect(nn).toEqual({ code: "postgres.constraint", data: { kind: "notNull" }, name: "n" });
      } finally {
        mode.done();
      }
    });

    test("a `Secret` or `undefined` parameter throws E2457 naming its position", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const db = notesDb(cap, table);
        const ctx = await mode.ctx(cap);
        const T = sqlName(table);
        const bad: unknown[] = [s.secret(s.string()).parse("hunter2-value"), undefined];
        for (const v of bad) {
          const err = await (async () => {
            try {
              await db(ctx).run(sql(NoRows)`insert into ${T} values (${1}, ${v})`);
              return undefined;
            } catch (e) {
              return e;
            }
          })();
          expect(e2457(err)).toBe(true);
          expect(String(err)).toContain("2");
          expect(String(err)).not.toContain("hunter2-value");
        }
      } finally {
        mode.done();
      }
    });
  });
}

test("a parameter that is not a JSON value (function, bigint, symbol, Map, NaN, Infinity, an array holding undefined) throws E2457", () => {
  const S = s.object({});
  const bad: unknown[] = [() => 1, 1n, Symbol("x"), new Map(), Number.NaN, Number.POSITIVE_INFINITY, [1, undefined]];
  for (const v of bad) {
    let thrown: unknown;
    try {
      sql(S)`select ${v}`;
    } catch (e) {
      thrown = e;
    }
    expect(e2457(thrown)).toBe(true);
  }
});
