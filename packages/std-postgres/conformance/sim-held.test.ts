// Spec: std.postgres, clause "Under `simulate` with `replay` of a `SimRun` of seed 1 whose plan for the database is `[{ delay: 500, fault: 'none' }]`, a scenario that awaits a lone `query` and calls no `run` gets its answer with `ctx.clock.now()` 500; with that plan empty, a `transaction` whose `fn` runs a `tx` statement, awaits `ctx.clock.after(100)` and runs another commits both, answering with `ctx.clock.now()` 100."
// Spec: std.postgres, clause "In an empty replay (k.drive), a first `query` on a database no earlier run used, started beside a `ctx.clock.after(1)` waiter, answers with `ctx.clock.now()` 0 and the waiter not resolved."
// Spec: std.postgres, clause "In an empty replay (k.drive), a scenario that runs two `insert` statements through `query`, each committing, then awaits `ctx.clock.after(10)`, resolves `simulate` with `ctx.clock.now()` 10, less than 5,000 ms of real time after the first `insert` answers."
// std.postgres, Modes "Under sim the engine's boot and each call into PGlite (a statement, `begin`, `commit`, `rollback`, a migration) are held (k.drive) from the call until PGlite answers, labelled `<capability> boot` and `<capability> query`; a plan step's `delay`, the wait for the database to be free and `fn`'s own awaits are not: each waits on held or parked work."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1.
// Assumption: "a database no earlier run used" is a `fresh()` capability name, so the first query boots the engine inside the run; its boot is held, a plan step takes no part in it.
// Assumption: the capability's plan is `plans[<database name>]` (k.sim); the first query's migration takes no step and is held (a held call the drive waits for).
// Assumption: "the wait for the database to be free": a lone statement started while a `transaction` is open waits behind it; it answers once the transaction's `fn` has finished, so no E1728 and no deadlock.
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";
import { ENGINE_BOUND, Row, SEED, fresh, notesDb, okOf, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
}, ENGINE_BOUND);

type Step = { delay: number; fault: "none" };
const replayOf = (cap: string, plan: Step[]) => ({
  seed: 1,
  schedule: { net: [], storage: [], offline: [], plans: { [cap]: plan } },
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 whose plan for the database is `[{ delay: 500, fault: 'none' }]`, a scenario that awaits a lone `query` and calls no `run` gets its answer with `ctx.clock.now()` 500", async () => {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  await simulate(
    async ({ ctx }) => {
      okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`));
      expect(ctx.clock.now()).toBe(500);
    },
    { replay: replayOf(cap, [{ delay: 500, fault: "none" }]) },
  );
});

test("a lone `query` under a plan step of any `delay` is answered with `ctx.clock.now()` equal to the delay, with no `run`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 60_000 }), async (delay) => {
      const { cap, table } = fresh();
      const db = notesDb(cap, table);
      const T = sqlName(table);
      await simulate(
        async ({ ctx }) => {
          okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`));
          expect(ctx.clock.now()).toBe(delay);
        },
        { replay: replayOf(cap, [{ delay, fault: "none" }]) },
      );
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("with that plan empty, a `transaction` whose `fn` runs a `tx` statement, awaits `ctx.clock.after(100)` and runs another commits both, answering with `ctx.clock.now()` 100", async () => {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  await simulate(
    async ({ ctx }) => {
      const r = await db(ctx).transaction(async (tx) => {
        okOf(await tx.run(sql(NoRows)`insert into ${T} values (1, 'a')`));
        await ctx.clock.after(100);
        okOf(await tx.run(sql(NoRows)`insert into ${T} values (2, 'b')`));
        return ok(true);
      });
      okOf(r);
      expect(ctx.clock.now()).toBe(100);
      expect(okOf(await db(ctx).query(sql(Row)`select id, name from ${T} order by id`))).toEqual([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
      ]);
    },
    { replay: replayOf(cap, []) },
  );
});

test("a `transaction` whose `fn` awaits `ctx.clock.after(d)` between statements answers at `d` and commits all its statements, for any `d`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 1, max: 3 }), async (d, n) => {
      const { cap, table } = fresh();
      const db = notesDb(cap, table);
      const T = sqlName(table);
      let answeredAt = -1;
      let count = 0;
      await simulate(
        async ({ ctx }) => {
          okOf(
            await db(ctx).transaction(async (tx) => {
              for (let i = 0; i < n; i++) {
                okOf(await tx.run(sql(NoRows)`insert into ${T} values (${i}, ${`n${i}`})`));
                if (i < n - 1) await ctx.clock.after(d);
              }
              return ok(true);
            }),
          );
          answeredAt = ctx.clock.now();
          count = okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`)).length;
        },
        { replay: replayOf(cap, []) },
      );
      expect(answeredAt).toBe(d * (n - 1));
      expect(count).toBe(n);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("a lone statement started while a `transaction` is open waits for the database to be free, which is not held: it answers after the transaction, with no stall", async () => {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  await simulate(
    async ({ ctx }) => {
      const tx = db(ctx).transaction(async (t) => {
        okOf(await t.run(sql(NoRows)`insert into ${T} values (1, 'a')`));
        await ctx.clock.after(250);
        return ok(true);
      });
      const q = db(ctx).query(sql(Row)`select id, name from ${T}`);
      okOf(await tx);
      const txAt = ctx.clock.now();
      okOf(await q);
      expect(txAt).toBe(250);
      expect(ctx.clock.now()).toBeGreaterThanOrEqual(250);
    },
    { replay: replayOf(cap, []) },
  );
});

test("a `transaction` whose `fn` returns `err` rolls back with every PGlite call held and answered, the clock unmoved", async () => {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  await simulate(
    async ({ ctx }) => {
      const r = await db(ctx).transaction(async (tx) => {
        okOf(await tx.run(sql(NoRows)`insert into ${T} values (1, 'a')`));
        return err({ code: "t.no" });
      });
      expect(r.ok).toBe(false);
      expect(ctx.clock.now()).toBe(0);
      expect(okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`)).length).toBe(0);
    },
    { replay: replayOf(cap, []) },
  );
});

test("In an empty replay (k.drive), a first `query` on a database no earlier run used, started beside a `ctx.clock.after(1)` waiter, answers with `ctx.clock.now()` 0 and the waiter not resolved.", async () => {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  await simulate(
    async ({ ctx }) => {
      let resolved = false;
      const ac = new AbortController();
      const w = ctx.clock.after(1, ac.signal).then(
        () => {
          resolved = true;
        },
        () => undefined,
      );
      okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`));
      expect({ now: ctx.clock.now(), waiter: resolved }).toEqual({ now: 0, waiter: false });
      ac.abort();
      await w;
    },
    { replay: replayOf(cap, []) },
  );
});

test("a first `query` on a database no earlier run used answers at `ctx.clock.now()` 0 beside a `ctx.clock.after(d)` waiter of any `d`, the waiter not resolved", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 60_000 }), async (d) => {
      const { cap, table } = fresh();
      const db = notesDb(cap, table);
      const T = sqlName(table);
      await simulate(
        async ({ ctx }) => {
          let resolved = false;
          const ac = new AbortController();
          const w = ctx.clock.after(d, ac.signal).then(
            () => {
              resolved = true;
            },
            () => undefined,
          );
          okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`));
          expect({ now: ctx.clock.now(), waiter: resolved }).toEqual({ now: 0, waiter: false });
          ac.abort();
          await w;
        },
        { replay: replayOf(cap, []) },
      );
    }),
    { seed: SEED, numRuns: 5 },
  );
});

// ASSUMPTION: an `insert` through `query` is `insert ... returning id, name` parsed by `Row`; the real-time bound is read with `hrtime` from the first insert's answer to the end of `simulate`.
async function twoInserts(ids: [number, number]): Promise<{ now: number; ms: number }> {
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  let now = -1;
  let start = 0n;
  await simulate(
    async ({ ctx }) => {
      okOf(await db(ctx).query(sql(Row)`insert into ${T} values (${ids[0]}, 'a') returning id, name`));
      start = process.hrtime.bigint();
      okOf(await db(ctx).query(sql(Row)`insert into ${T} values (${ids[1]}, 'b') returning id, name`));
      await ctx.clock.after(10);
      now = ctx.clock.now();
    },
    { replay: replayOf(cap, []) },
  );
  return { now, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test("In an empty replay (k.drive), a scenario that runs two `insert` statements through `query`, each committing, then awaits `ctx.clock.after(10)`, resolves `simulate` with `ctx.clock.now()` 10, less than 5,000 ms of real time after the first `insert` answers.", async () => {
  const r = await twoInserts([1, 2]);
  expect(r.now).toBe(10);
  expect(r.ms).toBeLessThan(5000);
});

test("two committing `insert` statements through `query` leave no work for any two distinct ids: the scenario resolves at `ctx.clock.now()` 10", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1001, max: 2000 }), async (a, b) => {
      const r = await twoInserts([a, b]);
      expect(r.now).toBe(10);
      expect(r.ms).toBeLessThan(5000);
    }),
    { seed: SEED, numRuns: 5 },
  );
}, 60_000);
