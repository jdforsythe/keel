// Spec: std.statecharts, Conformance "A state whose every exit is guarded false from some reachable `data` appears in `dead`."
// Seed: 1337.
// Assumption: as in closed-explore.test.ts; `dead` is an array of state names, compared sorted.
import { s } from "@keel/schema";
import { chart, coverage } from "@keel/std-statecharts";
import { explore } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { editor, nextId } from "./fixtures.ts";

const counter = (max: number) =>
  chart(nextId("counter"), {
    data: s.object({ n: s.int({ min: 0, max }) }),
    start: { n: 0 },
    events: { go: s.object({}), finish: s.object({}) },
    guards: { more: (d) => d.n < max, ready: (d) => d.n > max },
    actions: { inc: (d) => ({ n: Math.min(max, d.n + 1) }) },
    initial: "idle",
    states: {
      idle: { on: { go: { to: "work", do: "inc" } } },
      work: { on: { go: { to: "work", guard: "more", do: "inc" }, finish: { to: "done", guard: "ready" } } },
      done: { final: true },
    },
  });

describe("std.statecharts: stuck states", () => {
  test("A state whose every exit is guarded false from some reachable `data` appears in `dead`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (max) => {
        const c = counter(max);
        const r = explore(Object.values(c.events));
        expect(r.complete).toBe(true);
        const cov = coverage(c, r);
        expect([...cov.dead].sort()).toEqual(["work"]);
        expect(cov.unreached).toEqual(["done"]);
      }),
      { seed: 1337, numRuns: 20 },
    );
    // a chart whose exits are always open, and whose final state is terminal, has no dead state
    const e = editor("alive");
    const r = explore(Object.values(e.events));
    expect(coverage(e, r).dead).toEqual([]);
  });
});
