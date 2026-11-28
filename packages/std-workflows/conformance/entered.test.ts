// std.workflows, Store "a taken target with a `to`, its own state too, raises `entered` by one and `attempt` resets to 0"
// Seed: 1337.
// Assumption: as in self-entry.test.ts; the instance row is read through `commitStores`, and `entered` is compared before and after the `pick` event, so its start value is not fixed.
// Assumption: a workflow with no step and no wait is valid; the chart's `pick` event has `[{ to: <own state>, guard: a }, { guard: b }]`.
import { ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { chart } from "@keel/std-statecharts";
import { workflow } from "@keel/std-workflows";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { nextId, sim, inRoot } from "./fixtures.ts";

const none = s.object({});
const Flag = s.int({ min: 0, max: 1 });
const flag = fc.integer({ min: 0, max: 1 });
const Data = s.object({ a: Flag, b: Flag });

const pickFlow = () => {
  const c = inRoot(() =>
    chart(nextId("enteredChart"), {
      data: Data,
      start: { a: 0, b: 0 },
      events: { begin: none, pick: none, finish: none },
      guards: { a: (d) => d.a === 1, b: (d) => d.b === 1 },
      initial: "queued",
      states: {
        queued: { on: { begin: "picking" } },
        picking: { on: { pick: [{ to: "picking", guard: "a" }, { guard: "b" }], finish: "done" } },
        done: { final: true },
      },
    }),
  );
  return inRoot(() => workflow(nextId("entered"), { chart: c, steps: {}, waits: {} }));
};

test("a taken target with a `to`, its own state too, raises `entered` by one and `attempt` resets to 0: a chart whose event has `[{ to: <its own state>, guard: a }, { guard: b }]` raises `entered` exactly when `a` holds", async () => {
  await fc.assert(
    fc.asyncProperty(flag, flag, async (a, b) => {
      const ctx = sim();
      const wf = pickFlow();
      const id = ctx.random.id("Flow");
      const row = async (fn: (S: ReturnType<typeof wf.stores>) => void) => {
        const out: { state: string; entered: number; attempt: number }[] = [];
        const r = await commitStores(ctx, wf.stores, (S) => {
          fn(S);
          const x = S.store.snapshot().state.instances[id];
          if (x !== undefined) out.push({ state: x.state, entered: x.entered, attempt: x.attempt });
          return ok(null);
        });
        if (!r.ok) throw new Error(`commitStores failed: ${r.error.code}`);
        const last = out[out.length - 1];
        if (last === undefined) throw new Error("no instance row");
        return last;
      };
      await row((S) => {
        tx(S.start, { id, data: { a, b } });
      });
      const before = await row((S) => {
        tx(S.events.begin, { id, payload: {} });
      });
      expect(before.state).toBe("picking");
      const after = await row((S) => {
        tx(S.events.pick, { id, payload: {} });
      });
      expect(after.state).toBe("picking");
      expect(after.entered).toBe(before.entered + (a === 1 ? 1 : 0));
      if (a === 1) expect(after.attempt).toBe(0);
    }),
    { seed: 1337, numRuns: 20 },
  );
});
