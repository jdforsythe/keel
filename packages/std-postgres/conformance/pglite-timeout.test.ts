// Spec: std.postgres-errors, clause "On a `pglite:` folder each of `set statement_timeout = 5`, `set local statement_timeout = 5` inside a `transaction`, `select set_config('statement' || '_timeout', '5', false)`, `set U&\"statement\\005ftimeout\" = 5`, and `select f()` with `f` a function calling `set_config('statement_timeout', '5', false)`, rejects with the E2461 defect whose `data.sqlstate` is `0A000`, and `show statement_timeout` is `0` after it."
// Spec: std.postgres-errors, clause "On a `pglite:` folder `alter database postgres set statement_timeout = 5` and `alter role postgres set statement_timeout = 5` reject with that defect and leave `pg_db_role_setting` naming no `statement_timeout`; the folder opened again reads `0`."
// Spec: std.postgres-errors, clause "On a `pglite:` folder `create function g() returns int language sql set statement_timeout = 5 as 'select 1'` rejects with that defect and leaves `g`'s `proconfig` null."
// Spec: std.postgres-errors, clause "On a `pglite:` folder `set statement_timeout = 0` and `select 1` answer as on Postgres, and the same statements under sim are judged the same way."
// Seed 1337.
// Assumption: "the folder opened again" is a second `ctx` over the same `cap` (the same folder); each case runs on a fresh folder.
// Assumption: "judged the same way" under sim is that the same statements are refused with E2461 `0A000` there too and `set statement_timeout = 0` is not.
import { isDefect, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { FOLDER_BOUND, MODES, SEED, fresh, migrationsOf, okOf, sqlName, tpl } from "./fixtures.ts";

const Shown = s.object({ statement_timeout: s.string() });
const One = s.object({ n: s.int() });
const Settings = s.object({ n: s.int() });
const thrownBy = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );
const expectRefused = (v: unknown): void => {
  expect(isDefect(v, "E2461")).toBe(true);
  expect(v instanceof Error && Object.getOwnPropertyDescriptor(v, "data")?.value).toEqual({ sqlstate: "0A000" });
};
function setup() {
  const { cap, table } = fresh();
  const f = `${table}_f`;
  const db = database(cap, {
    migrations: migrationsOf(
      `create function ${f}() returns text language sql as $$ select set_config('statement_timeout', '5', false) $$`,
    ),
  });
  return { cap, db, f, g: `${table}_g` };
}

for (const m of MODES.filter((x) => x.name === "pglite")) {
  describe(m.name, () => {
    const refused: readonly (readonly [string, string, boolean])[] = [
      ["set statement_timeout = 5", "set statement_timeout = 5", false],
      ["set local statement_timeout = 5 inside a transaction", "set local statement_timeout = 5", true],
      [
        "select set_config('statement' || '_timeout', '5', false)",
        "select set_config('statement' || '_timeout', '5', false)",
        false,
      ],
      ['set U&"statement\\005ftimeout" = 5', 'set U&"statement\\005ftimeout" = 5', false],
    ];
    for (const [name, text, inTx] of refused) {
      test(
        `${name} rejects with the E2461 defect (0A000) and \`show statement_timeout\` is 0 after it`,
        async () => {
          const x = setup();
          const mode = m.make();
          try {
            const db = x.db(await mode.ctx(x.cap));
            const v = inTx
              ? await thrownBy(db.transaction(async (tx) => tx.run(sql(NoRows)(tpl([text])))))
              : await thrownBy(db.run(sql(NoRows)(tpl([text]))));
            expectRefused(v);
            expect(okOf(await db.query(sql(Shown)`show statement_timeout`))).toEqual([{ statement_timeout: "0" }]);
          } finally {
            mode.done();
          }
        },
        FOLDER_BOUND,
      );
    }

    test(
      "`select f()` with `f` a function calling set_config('statement_timeout', '5', false) rejects with the E2461 defect and `show statement_timeout` is 0",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          expectRefused(await thrownBy(db.query(sql(Shown)`select ${sqlName(x.f)}() as statement_timeout`)));
          expect(okOf(await db.query(sql(Shown)`show statement_timeout`))).toEqual([{ statement_timeout: "0" }]);
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    for (const text of [
      "alter database postgres set statement_timeout = 5",
      "alter role postgres set statement_timeout = 5",
    ]) {
      test(
        `\`${text}\` rejects with that defect, leaves pg_db_role_setting naming no statement_timeout, and the folder opened again reads 0`,
        async () => {
          const x = setup();
          const mode = m.make();
          try {
            const db = x.db(await mode.ctx(x.cap));
            expectRefused(await thrownBy(db.run(sql(NoRows)(tpl([text])))));
            const named = okOf(
              await db.query(
                sql(
                  Settings,
                )`select count(*)::int as n from pg_db_role_setting where setconfig::text like '%statement_timeout%'`,
              ),
            );
            expect(named).toEqual([{ n: 0 }]);
          } finally {
            mode.done();
          }
          const again = m.make();
          try {
            const db2 = x.db(await again.ctx(x.cap));
            expect(okOf(await db2.query(sql(Shown)`show statement_timeout`))).toEqual([{ statement_timeout: "0" }]);
          } finally {
            again.done();
          }
        },
        FOLDER_BOUND * 2,
      );
    }

    test(
      "`create function g() returns int language sql set statement_timeout = 5 as 'select 1'` rejects with that defect and leaves g's proconfig null",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          const text = `create function ${x.g}() returns int language sql set statement_timeout = 5 as 'select 1'`;
          expectRefused(await thrownBy(db.run(sql(NoRows)(tpl([text])))));
          const rows = okOf(
            await db.query(
              sql(Settings)`select count(*)::int as n from pg_proc where proname = ${x.g} and proconfig is not null`,
            ),
          );
          expect(rows).toEqual([{ n: 0 }]);
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "`set statement_timeout = 0` and `select 1` answer as on Postgres",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          okOf(await db.run(sql(NoRows)`set statement_timeout = 0`));
          expect(okOf(await db.query(sql(One)`select 1 as n`))).toEqual([{ n: 1 }]);
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "property: any positive value set through `set` is refused with the E2461 defect (0A000) and leaves the timeout at 0, by value and not by spelling",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          await fc.assert(
            fc.asyncProperty(
              fc.integer({ min: 1, max: 100000 }),
              fc.constantFrom("set", "SET", "set session", "set local"),
              async (n, verb) => {
                const text = `${verb} statement_timeout = ${n}`;
                const v = await thrownBy(db.transaction(async (tx) => tx.run(sql(NoRows)(tpl([text])))));
                expectRefused(v);
                expect(okOf(await db.query(sql(Shown)`show statement_timeout`))).toEqual([{ statement_timeout: "0" }]);
              },
            ),
            { seed: SEED, numRuns: 8 },
          );
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 8,
    );
  });
}

// UNTESTABLE here: "the same statements under sim are judged the same way" (the sim engine in MODES runs no SQL; the folder's sim-held and sim-transaction-plan files hold what sim answers).
// Postgres 17 cases: the folder gates them on `KEEL_TEST_POSTGRES_URL` (an operator-started `postgres:17` container); this writer started none.
