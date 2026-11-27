// Spec: std.postgres-errors, clause "A driver error whose `code` is `08000`, `08001`, `08003`, `08006`, `57P01` or `53300` is `err` `keel.unreachable`; `08007` is `err` `postgres.database` with data `{ sqlstate: '08007' }`; `08004` and `08P01` reject with a value `isDefect(v, 'E2461')` accepts whose `data` is `{ sqlstate }` and whose message is `E2461 std.postgres: the database answered an SQLSTATE no error takes`."
// Spec: std.postgres-errors, clause "Under sim, a plan of three `conflict` steps makes a `transaction` `err` `keel.conflict` whose `cause` has code `postgres.database` and data `{ sqlstate: '40001' }`; on Postgres 17, a deadlock on each of three runs gives the `cause` `{ sqlstate: '40P01' }`."
// std.postgres-errors, By SQLSTATE: the table, row by row (a row failing its schema, class 23, the reruns, no answer, 08007, the classes that are `postgres.database`, any other SQLSTATE), and "No error, defect or log line holds a parameter, a row value or the database's message text."
// Seed 1337. Gate: PGlite always; Postgres 17 only with `KEEL_TEST_POSTGRES_URL` (the shared `MODES`); the sim case runs no SQL; no case is skipped by a marker but the Postgres 17 deadlock by `describe.skipIf` as the folder does.
// Assumption: a driver error of a given SQLSTATE is raised by a plpgsql function (`raise exception '%', msg using errcode = code`), as class-08.test.ts does; the reruns 40001 and 40P01 so raised are run three times and then `keel.conflict`, as a real one is.
// Assumption: an error's `cause` is read as the property `cause` of the `err` value (k.attempt: `KeelError` gains `cause`).
// Postgres 17 deadlock: three runs of one `transaction` each pair with a partner `transaction` holding the second row and asking for the first only after the first run's statement waits on a lock; the first to wait is the one the server aborts.
import { isDefect, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  ENGINE_BOUND,
  FOLDER_BOUND,
  MODES,
  SEED,
  errOf,
  fresh,
  hasPg17,
  migrationsOf,
  none,
  notesDb,
  okOf,
  simCtx,
  sqlName,
} from "./fixtures.ts";

const Value = s.object({ v: s.string() });
const Count = s.object({ c: s.int() });
const MESSAGE = "E2461 std.postgres: the database answered an SQLSTATE no error takes";
const DRIVER_TEXT = "driver-text-jane@x.com-4111111111111111";

function setup() {
  const { cap, table } = fresh();
  const raise = `${table}_raise`;
  const db = database(cap, {
    migrations: migrationsOf(
      `create function ${raise}(code text, msg text) returns text language plpgsql as $$ begin raise exception '%', msg using errcode = code; end $$`,
      `create table ${table} (id int primary key, n int not null)`,
    ),
  });
  return { cap, table, db, raise };
}
const prop = (e: unknown, key: string): unknown =>
  typeof e === "object" && e !== null ? Reflect.get(e, key) : undefined;
const rejected = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

// One SQLSTATE family per row of the table, with several members each.
const DATABASE = [
  "22001",
  "22P02",
  "22003",
  "40002",
  "40003",
  "53100",
  "53200",
  "54000",
  "54001",
  "55000",
  "55P03",
  "57000",
  "57014",
  "57P04",
  "P0001",
  "P0002",
];
const UNREACHABLE = ["08000", "08001", "08003", "08006", "57P01", "57P02", "57P03", "53300"];
const DEFECT = [
  "42P01",
  "42601",
  "42703",
  "XX000",
  "XX001",
  "0A000",
  "08004",
  "08P01",
  "08002",
  "25P02",
  "3F000",
  "HV000",
];

for (const m of MODES.filter((x) => x.name !== "sim")) {
  describe(m.name, () => {
    test(
      "a row failing its schema is `postgres.result`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          expect(errOf(await db.query(sql(Value)`select 1 as v`)).code).toBe("postgres.result");
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "class 23 is `postgres.constraint`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          const T = sqlName(x.table);
          okOf(await db.run(sql(NoRows)`insert into ${T} values (1, 1)`));
          expect(errOf(await db.run(sql(NoRows)`insert into ${T} values (1, 2)`)).code).toBe("postgres.constraint");
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "`40001` and `40P01` run again at most 3 runs, then `keel.conflict` whose `cause` is `postgres.database` with that SQLSTATE",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          for (const code of ["40001", "40P01"]) {
            const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raise)}(${code}, ${"x"}) as v`));
            expect(e.code, code).toBe("keel.conflict");
            expect(prop(prop(e, "cause"), "code"), code).toBe("postgres.database");
            expect(prop(prop(e, "cause"), "data"), code).toEqual({ sqlstate: code });
          }
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 2,
    );

    test(
      "`08000`, `08001`, `08003`, `08006`, `57P01` to `57P03` and `53300`, no answer, are `keel.unreachable`",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          for (const code of UNREACHABLE) {
            const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raise)}(${code}, ${"x"}) as v`));
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
          const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raise)}(${"08007"}, ${"x"}) as v`));
          expect(e.code).toBe("postgres.database");
          expect(prop(e, "data")).toEqual({ sqlstate: "08007" });
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND,
    );

    test(
      "property: classes `22`, `40` (but the reruns), `53` (but `53300`), `54`, `55`, `57` (but `57P01` to `57P03`) and `P0` are `postgres.database` with data `{ sqlstate }` and nothing else",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          await fc.assert(
            fc.asyncProperty(fc.constantFrom(...DATABASE), async (code) => {
              const e = errOf(await db.query(sql(Value)`select ${sqlName(x.raise)}(${code}, ${"x"}) as v`));
              expect(e.code, code).toBe("postgres.database");
              expect(prop(e, "data"), code).toEqual({ sqlstate: code });
            }),
            { seed: SEED, numRuns: DATABASE.length },
          );
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 3,
    );

    test(
      "property: any other SQLSTATE (class `42`, `XX`, `0A`, `08004`, `08P01` and the rest of class `08`) rejects with the E2461 defect whose data is `{ sqlstate }` and whose message is the rule's",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          await fc.assert(
            fc.asyncProperty(fc.constantFrom(...DEFECT), async (code) => {
              const v = await rejected(db.query(sql(Value)`select ${sqlName(x.raise)}(${code}, ${"x"}) as v`));
              expect(isDefect(v, "E2461"), code).toBe(true);
              expect(v instanceof Error && v.message, code).toBe(MESSAGE);
              expect(prop(v, "data"), code).toEqual({ sqlstate: code });
            }),
            { seed: SEED, numRuns: DEFECT.length },
          );
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 3,
    );

    test(
      "property: no error, defect or log line holds a parameter, a row value or the database's message text, for any SQLSTATE of the table",
      async () => {
        const x = setup();
        const mode = m.make();
        try {
          const db = x.db(await mode.ctx(x.cap));
          await fc.assert(
            fc.asyncProperty(
              fc.constantFrom(...DATABASE, ...UNREACHABLE, ...DEFECT, "40001", "40P01", "08007"),
              async (code) => {
                const r = await db.query(sql(Value)`select ${sqlName(x.raise)}(${code}, ${DRIVER_TEXT}) as v`).then(
                  (v) => v,
                  (e: unknown) => e,
                );
                const text = JSON.stringify(r, (_k, v: unknown) =>
                  v instanceof Error ? { message: v.message, ...v } : v,
                );
                expect(text, code).not.toContain("jane@x.com");
                expect(text, code).not.toContain("4111");
                expect(text, code).not.toContain("driver-text");
              },
            ),
            { seed: SEED, numRuns: 40 },
          );
        } finally {
          mode.done();
        }
      },
      FOLDER_BOUND * 4,
    );
  });
}

describe("sim", () => {
  test(
    "a plan of three `conflict` steps makes a `transaction` `err` `keel.conflict` whose `cause` has code `postgres.database` and data `{ sqlstate: '40001' }`",
    async () => {
      const { cap, table } = fresh();
      const C = { delay: 0, fault: "conflict" as const };
      const db = notesDb(cap, table);
      const ctx = simCtx(cap, [C, C, C, ...none(5)]);
      const T = sqlName(table);
      const r = await db(ctx).transaction(async (tx) => tx.run(sql(NoRows)`insert into ${T} values (1, 'a')`));
      const e = errOf(r);
      expect(e.code).toBe("keel.conflict");
      expect(prop(prop(e, "cause"), "code")).toBe("postgres.database");
      expect(prop(prop(e, "cause"), "data")).toEqual({ sqlstate: "40001" });
    },
    ENGINE_BOUND,
  );
});

describe.skipIf(!hasPg17)("postgres 17", () => {
  test(
    "a deadlock on each of three runs of a `transaction` gives `keel.conflict` whose `cause` is `postgres.database` with `{ sqlstate: '40P01' }`",
    async () => {
      const pg = MODES.find((m) => m.name === "postgres 17");
      if (pg === undefined) throw new Error("no postgres 17 mode");
      const { cap, table } = fresh();
      const db = database(cap, { migrations: migrationsOf(`create table ${table} (id int primary key)`) });
      const mode = pg.make();
      try {
        const ctx = await mode.ctx(cap);
        okOf(await db(ctx).query(sql(Count)`select count(*)::int as c from ${sqlName(table)}`));
        // Advisory locks: waiting on one is a lock wait, a deadlock between two sessions is 40P01, and no row changes, so a rerun meets no serialization failure.
        const first = `${table}-first`;
        const second = `${table}-second`;
        const take = (key: string) =>
          sql(Count)`select 1 as c from (select pg_advisory_xact_lock(hashtext(${key}))) as l`;
        const waiting = async (): Promise<number> =>
          okOf(
            await db(ctx).one(
              sql(
                Count,
              )`select count(*)::int as c from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory' and query like '%pg_advisory_xact_lock(hashtext%' and pid <> pg_backend_pid()`,
            ),
          ).c;
        const gates = [0, 1, 2].map(() => {
          let open: () => void = () => undefined;
          const promise = new Promise<void>((resolve) => {
            open = resolve;
          });
          return { open, promise };
        });
        let runs = 0;
        // One partner `transaction` per run: it holds the second lock, lets the run ask for it, asks for the first once the run waits (and a margin later, so the run's wait began first and the server aborts it), then commits.
        const partner = async (): Promise<void> => {
          for (const gate of gates) {
            const r = await db(ctx).transaction(async (tx) => {
              const held = await tx.one(take(second));
              if (!held.ok) return held;
              gate.open();
              let polls = 0;
              while ((await waiting()) === 0 && polls < 5000) polls += 1;
              for (let margin = 0; margin < 50; margin += 1) await waiting();
              return tx.one(take(first));
            });
            okOf(r);
          }
        };
        const side = partner();
        const r = await db(ctx).transaction(async (tx) => {
          const k = runs;
          runs += 1;
          const held = await tx.one(take(first));
          if (!held.ok) return held;
          await gates[Math.min(k, 2)]?.promise;
          return tx.one(take(second));
        });
        await side;
        const e = errOf(r);
        expect(runs).toBe(3);
        expect(e.code).toBe("keel.conflict");
        expect(prop(prop(e, "cause"), "code")).toBe("postgres.database");
        expect(prop(prop(e, "cause"), "data")).toEqual({ sqlstate: "40P01" });
      } finally {
        mode.done();
      }
    },
    FOLDER_BOUND * 3,
  );
});
