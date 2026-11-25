// Spec: std.postgres-changes, Conformance "Under sim, on a `pglite:` folder and on Postgres 17 in CI, a `follow` started before a `transaction` that calls `changed(ch, { b: 'x' })` twice and commits gets one `changed`; one whose `fn` returns `err` gets none; under sim a plan `conflict`, `none` that calls `changed` in each run gets one."
// Spec: std.postgres, Modes "Under sim, delivery of a change happens when the committing step settles, in step order, with no timer."
// Spec: std.postgres-changes, API "On the database object it is its own transaction, delivered when it commits."
// Seed: 1337.
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: Postgres 17 runs only with `KEEL_TEST_POSTGRES_URL` (MODES holds it only then, as `hasPg17`); "none" is shown by `flush` (a later commit on the same connection arriving).
import { err, ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import type { SimCtx } from "@keel/ctx";
import { boardChannel, changed, flush, keyOf, watch } from "./follow-fixtures.ts";
import { ENGINE_BOUND, MODES, Row, SEED, fresh, none, notesDb, okOf, simCtx, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
}, ENGINE_BOUND);

for (const m of MODES) {
  describe(m.name, () => {
    test("a `follow` started before a `transaction` that calls `changed(ch, { b: 'x' })` twice and commits gets one `changed`", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const d = notesDb(cap, table)(await mode.ctx(cap));
        okOf(await d.query(sql(Row)`select id, name from ${sqlName(table)}`));
        const w = await watch(d, boardChannel, keyOf("x"));
        const r = await d.transaction(async (tx) => {
          okOf(await changed(tx, boardChannel, { b: "x" }));
          okOf(await changed(tx, boardChannel, { b: "x" }));
          return ok(null);
        });
        okOf(r);
        await flush(d);
        expect(w.events).toEqual([{ kind: "changed" }]);
        w.stop();
      } finally {
        mode.done();
      }
    });

    test("a `follow` started before a `transaction` whose `fn` returns `err` gets none", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const d = notesDb(cap, table)(await mode.ctx(cap));
        okOf(await d.query(sql(Row)`select id, name from ${sqlName(table)}`));
        const w = await watch(d, boardChannel, keyOf("x"));
        const r = await d.transaction(async (tx) => {
          okOf(await changed(tx, boardChannel, { b: "x" }));
          return err({ code: "t.no", message: "no", data: {} });
        });
        expect(r.ok).toBe(false);
        await flush(d);
        expect(w.events).toEqual([]);
        w.stop();
      } finally {
        mode.done();
      }
    });

    test("a `follow` started before a `transaction` whose `fn` throws gets none (rollback)", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const d = notesDb(cap, table)(await mode.ctx(cap));
        okOf(await d.query(sql(Row)`select id, name from ${sqlName(table)}`));
        const w = await watch(d, boardChannel, keyOf("x"));
        await expect(
          d.transaction(async (tx) => {
            okOf(await changed(tx, boardChannel, { b: "x" }));
            throw new Error("boom");
          }),
        ).rejects.toThrow("boom");
        await flush(d);
        expect(w.events).toEqual([]);
        w.stop();
      } finally {
        mode.done();
      }
    });

    test("`changed` on the database object is its own transaction, delivered once when it commits", async () => {
      const { cap, table } = fresh();
      const mode = m.make();
      try {
        const d = notesDb(cap, table)(await mode.ctx(cap));
        const w = await watch(d, boardChannel, keyOf("x"));
        expect(okOf(await changed(d, boardChannel, { b: "x" }))).toBeNull();
        await flush(d);
        expect(w.events).toEqual([{ kind: "changed" }]);
        w.stop();
      } finally {
        mode.done();
      }
    });
  });
}

test("under sim a plan `conflict`, `none` that calls `changed` in each run gets one", async () => {
  const { cap, table } = fresh();
  const ctx = simCtx(cap, [
    { delay: 0, fault: "conflict" },
    { delay: 0, fault: "none" },
  ]);
  const d = notesDb(cap, table)(ctx);
  const w = await watch(d, boardChannel, keyOf("x"));
  let runs = 0;
  const r = await d.transaction(async (tx) => {
    runs += 1;
    okOf(await changed(tx, boardChannel, { b: "x" }));
    return ok(null);
  });
  okOf(r);
  expect(runs).toBe(2);
  await flush(d);
  expect(w.events).toEqual([{ kind: "changed" }]);
});

test("under sim a lone `changed` is delivered when its step settles, not before, with no timer", async () => {
  const { cap, table } = fresh();
  const ctx: SimCtx = simCtx(cap, [{ delay: 10, fault: "none" }]);
  const d = notesDb(cap, table)(ctx);
  const w = await watch(d, boardChannel, keyOf("x"));
  const p = changed(d, boardChannel, { b: "x" });
  for (let i = 0; i < 50; i++) await new Promise<void>((r) => setImmediate(r));
  expect(w.events).toEqual([]);
  ctx.clock.advance(10);
  okOf(await p);
  expect(w.events).toEqual([{ kind: "changed" }]);
});

test("under sim, deliveries happen in step order across keys", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 8 }), async (order) => {
      const { cap, table } = fresh();
      const d = notesDb(cap, table)(simCtx(cap, none(50)));
      const seen: string[] = [];
      for (const k of ["a", "b", "c"]) {
        const f: unknown = Reflect.get(d, "follow");
        if (typeof f !== "function") throw new Error("no follow");
        await Reflect.apply(f, d, [boardChannel, keyOf(k), () => seen.push(k)]);
      }
      for (const k of order) okOf(await changed(d, boardChannel, { b: k }));
      expect(seen).toEqual(order);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
