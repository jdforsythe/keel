// Spec: std.postgres, Conformance "On Postgres 17, each pair waiting until both have read: two `transaction`s writing a counter's value read + 1 are each `ok` or `keel.conflict`, a `fn` runs twice, and the counter equals the `ok` count; two that each take their own doctor off call when two are on call leave one on call, or none with `allow: 'write skew'`."
// Spec: std.postgres, API "in one `serializable` transaction: committed ones have the effect of some serial order: no lost update, no write skew."
// Seed: 1337 (no generated inputs: the cases are fixed races).
// Pending (rfc:0184): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: runs only with `KEEL_TEST_POSTGRES_URL` (describe.skipIf); the barrier releases once both have arrived and stays open, so a rerun does not wait.
// Assumption: with `allow: 'write skew'` both doctor transactions are ok (the anomaly is expected, not merely allowed); the test requires zero on call.
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { describe, expect, test } from "vitest";
import { MODES, fresh, hasPg17, migrationsOf, okOf, sqlName } from "./fixtures.ts";

const Counter = s.object({ n: s.int() });
const Count = s.object({ c: s.int() });

function barrier(parties: number) {
  let arrived = 0;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived >= parties) open();
    await gate;
  };
}

const pg = MODES.find((m) => m.name === "postgres 17");

describe.skipIf(!hasPg17)("postgres 17", () => {
  test.skip("two `transaction`s writing a counter's value read + 1 are each `ok` or `keel.conflict`, a `fn` runs twice, and the counter equals the `ok` count", async () => {
    if (pg === undefined) return;
    const { cap, table } = fresh();
    const T = sqlName(table);
    const db = database(cap, {
      migrations: migrationsOf(`create table ${table} (id int primary key, n int not null)`, `insert into ${table} values (1, 0)`),
    });
    const mode = pg.make();
    try {
      const ctx = await mode.ctx(cap);
      okOf(await db(ctx).query(sql(Counter)`select n from ${T} where id = 1`));
      const wait = barrier(2);
      const runs = [0, 0];
      const one = (i: number) =>
        db(ctx).transaction(async (tx) => {
          runs[i] = (runs[i] ?? 0) + 1;
          const r = await tx.one(sql(Counter)`select n from ${T} where id = 1`);
          if (!r.ok) return r;
          await wait();
          return tx.run(sql(NoRows)`update ${T} set n = ${r.value.n + 1} where id = 1`);
        });
      const results = await Promise.all([one(0), one(1)]);
      for (const r of results) expect(r.ok || r.error.code === "keel.conflict").toBe(true);
      expect(runs.some((n) => n === 2)).toBe(true);
      const oks = results.filter((r) => r.ok).length;
      const final = okOf(await db(ctx).one(sql(Counter)`select n from ${T} where id = 1`));
      expect(final.n).toBe(oks);
    } finally {
      mode.done();
    }
  });

  for (const allow of [undefined, "write skew"] as const) {
    test.skip(`two that each take their own doctor off call when two are on call leave ${allow === undefined ? "one on call" : "none on call with `allow: 'write skew'`"}`, async () => {
      if (pg === undefined) return;
      const { cap, table } = fresh();
      const T = sqlName(table);
      const db = database(cap, {
        migrations: migrationsOf(
          `create table ${table} (name text primary key, on_call boolean not null)`,
          `insert into ${table} values ('a', true), ('b', true)`,
        ),
      });
      const mode = pg.make();
      try {
        const ctx = await mode.ctx(cap);
        okOf(await db(ctx).query(sql(Count)`select count(*)::int as c from ${T}`));
        const wait = barrier(2);
        const take = (name: string) =>
          db(ctx).transaction(
            async (tx) => {
              const r = await tx.one(sql(Count)`select count(*)::int as c from ${T} where on_call`);
              if (!r.ok) return r;
              await wait();
              if (r.value.c < 2) return r;
              return tx.run(sql(NoRows)`update ${T} set on_call = false where name = ${name}`);
            },
            allow === undefined ? undefined : { allow, reason: "doctor pair under test" },
          );
        const results = await Promise.all([take("a"), take("b")]);
        for (const r of results) expect(r.ok || r.error.code === "keel.conflict").toBe(true);
        const left = okOf(await db(ctx).one(sql(Count)`select count(*)::int as c from ${T} where on_call`));
        expect(left.c).toBe(allow === undefined ? 1 : 0);
      } finally {
        mode.done();
      }
    });
  }
});
