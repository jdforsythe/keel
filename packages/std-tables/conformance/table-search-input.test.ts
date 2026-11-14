// Spec: std.tables, Conformance "`TableSearch` navigates once, 300 ms after the last of three inputs, with `replace` and no `page`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: one navigation is observed as one loader run of the route (`dataset.loads`) and the resulting `route().search`.
// `replace` is not observable through the harness (its history is internal): the clause's `replace` is not asserted here.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, dataset, routes, simCtx, useRows } from "./fixtures.ts";

describe("std.tables: TableSearch", () => {
  test.skip("`TableSearch` navigates once, 300 ms after the last of three inputs, with `replace` and no `page`", async () => {
    useRows(12);
    const ctx = simCtx();
    const h = await renderRoute("tbl.find", { routes, params: {}, search: { sort: "title", page: 2 }, ctx });
    const before = dataset.loads;
    await h.fire("find.input", { type: "input", value: "i" });
    ctx.clock.advance(200);
    await h.fire("find.input", { type: "input", value: "it" });
    ctx.clock.advance(200);
    await h.fire("find.input", { type: "input", value: "ite" });
    ctx.clock.advance(299);
    await h.settle();
    expect(dataset.loads).toBe(before); // 299 ms after the last input: nothing yet
    expect(h.route()).toMatchObject({ search: { sort: "title", page: 2 } });
    ctx.clock.advance(1);
    await h.settle();
    expect(dataset.loads).toBe(before + 1); // once
    expect(h.route()).toEqual({ id: "tbl.find", params: {}, search: { sort: "title", q: "ite" }, pending: false });
    ctx.clock.advance(10_000);
    await h.settle();
    expect(dataset.loads).toBe(before + 1); // and no more
    h.dispose();
  });

  test.skip("for any gaps under 300 ms between three inputs the one navigation comes 300 ms after the last, and an empty `q` is absent (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 299 }),
        fc.integer({ min: 0, max: 299 }),
        fc.constantFrom("", "x", "tea"),
        async (gap1, gap2, last) => {
          useRows(12);
          const ctx = simCtx();
          const h = await renderRoute("tbl.find", { routes, params: {}, search: { page: 3 }, ctx });
          const before = dataset.loads;
          await h.fire("find.input", { type: "input", value: "a" });
          ctx.clock.advance(gap1);
          await h.fire("find.input", { type: "input", value: "ab" });
          ctx.clock.advance(gap2);
          await h.fire("find.input", { type: "input", value: last });
          ctx.clock.advance(299);
          await h.settle();
          expect(dataset.loads).toBe(before);
          ctx.clock.advance(1);
          await h.settle();
          expect(dataset.loads).toBe(before + 1);
          expect(h.route()).toEqual({
            id: "tbl.find",
            params: {},
            search: last === "" ? {} : { q: last },
            pending: false,
          });
          h.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});
