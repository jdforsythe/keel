// Spec: std.statecharts, Conformance "Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`, and `coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`."
// Seed: 1337.
// Assumption: `explore` comes from `@keel/testing` (k.model); `coverage` is imported from `@keel/std-statecharts` (the spec does not say where it lives);
// `unreached` and `dead` are arrays of state names, compared sorted.
import { s } from "@keel/schema";
import { coverage, chart } from "@keel/std-statecharts";
import { explore } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { editor, nextId } from "./fixtures.ts";

const lock = (limit: number) =>
  chart(nextId("lock"), {
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { inc: s.object({}), open: s.object({}) },
    guards: { tooMany: (d) => d.n > 3 + limit, ok: (d) => d.n < 3 },
    actions: { up: (d) => ({ n: Math.min(3, d.n + 1) }) },
    initial: "closed",
    states: {
      closed: { on: { inc: { guard: "ok", do: "up" }, open: { to: "vault", guard: "tooMany" } } },
      vault: { final: true },
    },
  });

describe("std.statecharts: closed-form exploration of a chart", () => {
  test.skip("Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`", () => {
    const c = editor("closed");
    const r = explore(Object.values(c.events));
    expect(r.complete).toBe(true);
    expect(r.states[0]).toEqual({ state: "viewing", data: { attempts: 0 } });
    const names = new Set(r.states.map((st) => st.state));
    expect([...names].sort()).toEqual(["conflict", "editing", "gaveUp", "saving", "viewing"]);
    expect(coverage(c, r).unreached).toEqual([]);
  });

  test.skip("`coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), (limit) => {
        const c = lock(limit);
        const r = explore(Object.values(c.events));
        expect(r.complete).toBe(true);
        expect(coverage(c, r).unreached).toEqual(["vault"]);
        expect(r.states.some((st) => st.state === "vault")).toBe(false);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
