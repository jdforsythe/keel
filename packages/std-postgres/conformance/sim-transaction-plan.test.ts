// Spec: std.postgres, Conformance "Under sim, a plan `conflict`, `conflict`, `none` makes a `transaction` run `fn` three times and commit once; `conflict` three times is `keel.conflict`, nothing committed; `fn`'s `err` commits nothing."
// Spec: std.postgres, API "`transaction(fn, { allow?, reason? })`: `fn(tx)`, `tx` with `query`, `one` and `run`, in one `serializable` transaction: committed ones have the effect of some serial order: no lost update, no write skew. `ok` commits, `err` or a throw rolls back. A serialization failure or deadlock runs `fn` again, at most 3 runs, then is `keel.conflict`, nothing committed; what `fn` does outside `tx` must be safe to repeat."
// Spec: std.postgres, Modes "each `query`, `one` and `run` and each run of `fn` takes one step, statements on `tx` none."
// Seed: 1337.
// Assumption: the capability's plan is `plans[<database name>]` (k.sim); the first query's migration takes no step.
// Assumption: a plan consumed past its end gives `none`; tests pad it with explicit `none` steps for the reads that check the table, so it does not matter.
// Assumption: a throw in `fn` rejects `transaction` and rolls back; `fn` returns a `Result`, and `transaction` returns it.
import { err, ok, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";
import { Row, SEED, errOf, fresh, none, notesDb, okOf, simCtx, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
});
const C = { delay: 0, fault: "conflict" as const };
const N = { delay: 0, fault: "none" as const };

async function setup(plan: { delay: number; fault: "none" | "unavailable" | "conflict" }[]) {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const ctx = simCtx(cap, plan);
  const T = sqlName(table);
  let runs = 0;
  return {
    db,
    ctx,
    T,
    table,
    runs: () => runs,
    bump: () => {
      runs += 1;
    },
  };
}

test("a plan `conflict`, `conflict`, `none` makes a `transaction` run `fn` three times and commit once", async () => {
  const x = await setup([C, C, N, ...none(5)]);
  const r = await x.db(x.ctx).transaction(async (tx) => {
    x.bump();
    return tx.run(sql(NoRows)`insert into ${x.T} values (1, 'a')`);
  });
  expect(okOf(r)).toBe(1);
  expect(x.runs()).toBe(3);
  const rows = okOf(await x.db(x.ctx).query(sql(Row)`select id, name from ${x.T}`));
  expect(rows).toEqual([{ id: 1, name: "a" }]);
});

test("`conflict` three times is `keel.conflict`, nothing committed", async () => {
  const x = await setup([C, C, C, ...none(5)]);
  const r = await x.db(x.ctx).transaction(async (tx) => {
    x.bump();
    return tx.run(sql(NoRows)`insert into ${x.T} values (1, 'a')`);
  });
  expect(errOf(r).code).toBe("keel.conflict");
  expect(x.runs()).toBe(3);
  expect(okOf(await x.db(x.ctx).query(sql(Row)`select id, name from ${x.T}`))).toEqual([]);
});

test("`fn`'s `err` commits nothing", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,10}$/), async (code) => {
      const x = await setup(none(8));
      const r = await x.db(x.ctx).transaction(async (tx) => {
        x.bump();
        const w = await tx.run(sql(NoRows)`insert into ${x.T} values (1, 'a')`);
        okOf(w);
        return err(s.error(`t.${code}`, s.object({})).make({}));
      });
      expect(errOf(r).code).toBe(`t.${code}`);
      expect(x.runs()).toBe(1);
      expect(okOf(await x.db(x.ctx).query(sql(Row)`select id, name from ${x.T}`))).toEqual([]);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("a throw in `fn` rolls back and rejects", async () => {
  const x = await setup(none(8));
  await expect(
    x.db(x.ctx).transaction(async (tx) => {
      okOf(await tx.run(sql(NoRows)`insert into ${x.T} values (1, 'a')`));
      throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(okOf(await x.db(x.ctx).query(sql(Row)`select id, name from ${x.T}`))).toEqual([]);
});

test("a plan of k `conflict` steps (k < 3) then `none` runs `fn` k + 1 times; statements on `tx` take no step", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 1, max: 4 }), async (k, stmts) => {
      const x = await setup([...Array.from({ length: k }, () => C), N, ...none(5)]);
      const r = await x.db(x.ctx).transaction(async (tx) => {
        x.bump();
        for (let i = 0; i < stmts; i++) okOf(await tx.run(sql(NoRows)`insert into ${x.T} values (${i}, ${`n${i}`})`));
        return ok(stmts);
      });
      expect(okOf(r)).toBe(stmts);
      expect(x.runs()).toBe(k + 1);
      expect(okOf(await x.db(x.ctx).query(sql(Row)`select id, name from ${x.T}`)).length).toBe(stmts);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
