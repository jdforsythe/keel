// The search input's debounce on the ctx clock and its target search. Seed 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { debounced } from "../src/internal/debounced.ts";
import { withQuery } from "../src/internal/withQuery.ts";

const SEED = 1337;

describe("TableSearch internals", () => {
  test("runs once, `ms` after the last of any pushes closer together than `ms`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 299 }), { maxLength: 5 }), async (gaps) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        let runs = 0;
        const d = debounced(
          ctx.clock,
          () => 300,
          () => {
            runs += 1;
          },
        );
        d.push();
        for (const gap of gaps) {
          ctx.clock.advance(gap);
          d.push();
        }
        ctx.clock.advance(299);
        await Promise.resolve();
        expect(runs).toBe(0);
        ctx.clock.advance(1);
        await Promise.resolve();
        await Promise.resolve();
        expect(runs).toBe(1);
        ctx.clock.advance(10_000);
        await Promise.resolve();
        expect(runs).toBe(1);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("cancel drops the pending run", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    let runs = 0;
    const d = debounced(
      ctx.clock,
      () => 300,
      () => {
        runs += 1;
      },
    );
    d.push();
    d.cancel();
    ctx.clock.advance(1000);
    await Promise.resolve();
    expect(runs).toBe(0);
  });

  test("the target search has `q`, absent when empty, and no `page`", () => {
    type R = { a: string; on: boolean };
    expect(withQuery<R, "a", "on">({ sort: "a", page: 3, on: true }, "tea")).toEqual({ sort: "a", q: "tea", on: true });
    expect(withQuery<R, "a", "on">({ q: "x", page: 2 }, "")).toEqual({});
  });
});
