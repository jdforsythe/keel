// Spec: std.postgres-changes, clause "A `follow` of `{ b: 'x' }` gets nothing for a change of `{ b: 'y' }`, another channel name or another capability on the same URL."
// std.postgres-changes, API "`params` is parsed by `channel.params` ... and keyed as its canonical JSON (keys sorted)."
// Seed: 1337.
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: "nothing" is shown by `flush` (a later commit on the same connection arriving) and a closing positive control: the follow then gets exactly the one `changed` of its own key.
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { MODES, SEED, fresh, notesDb, okOf, simCtx } from "./fixtures.ts";
import { boardChannel, canonical, changed, flush, keyOf, otherChannel, pairChannel, watch } from "./follow-fixtures.ts";

beforeAll(async () => {
  await ready();
});

for (const m of MODES) {
  describe(m.name, () => {
    test("a `follow` of `{ b: 'x' }` gets nothing for a change of `{ b: 'y' }`, another channel name or another capability on the same URL", async () => {
      const one = fresh();
      const two = fresh();
      const mode = m.make();
      try {
        const ctx = await mode.ctx(one.cap);
        const d = notesDb(one.cap, one.table)(ctx);
        const e = notesDb(two.cap, two.table)(ctx);
        const w = await watch(d, boardChannel, keyOf("x"));
        okOf(await changed(d, boardChannel, { b: "y" }));
        okOf(await changed(d, otherChannel, { b: "x" }));
        okOf(await changed(e, boardChannel, { b: "x" }));
        await flush(d);
        await flush(e);
        expect(w.events).toEqual([]);
        okOf(await changed(d, boardChannel, { b: "x" }));
        await flush(d);
        expect(w.events).toEqual([{ kind: "changed" }]);
        w.stop();
      } finally {
        mode.done();
      }
    });
  });
}

test("for any other value of `b`, a `follow` of `{ b: 'x' }` gets nothing", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ maxLength: 12 }).filter((v) => v !== "x"),
      async (other) => {
        const { cap, table } = fresh();
        const d = notesDb(cap, table)(simCtx(cap));
        const w = await watch(d, boardChannel, keyOf("x"));
        okOf(await changed(d, boardChannel, { b: other }));
        await flush(d);
        expect(w.events).toEqual([]);
        w.stop();
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("params are keyed as their canonical JSON: a change with keys in any order reaches the follow of the sorted key", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: -9, max: 9 }), fc.integer({ min: -9, max: 9 }), async (a, b) => {
      const { cap, table } = fresh();
      const d = notesDb(cap, table)(simCtx(cap));
      const w = await watch(d, pairChannel, canonical({ b, a }));
      okOf(await changed(d, pairChannel, { b, a }));
      okOf(await changed(d, pairChannel, { a, b }));
      await flush(d);
      expect(w.events).toEqual([{ kind: "changed" }, { kind: "changed" }]);
      w.stop();
    }),
    { seed: SEED, numRuns: 20 },
  );
});
