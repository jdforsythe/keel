// Spec: std.workflows, Conformance "For generated instances and events, a workflow event changes only its instance, to `chart.next` of it."
// Seed: 1337.
// Assumption: a started instance's `entered` and `attempt` start at values the spec does not fix, so only their change is asserted: `entered` rises by one exactly when the state name changes, and `attempt` is 0 then and unchanged otherwise.
// Assumption: `chart.next` of a final state is its argument, so a final instance equals its `next`.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FINAL, type Row, dataArb, evArb, fire, makeFlow, mutate, nextOf, rowsOf, sim, start } from "./fixtures.ts";

const never = async () => ok({ freed: 0 });

test("For generated instances and events, a workflow event changes only its instance, to `chart.next` of it.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(dataArb, { minLength: 1, maxLength: 4 }),
      fc.array(fc.tuple(fc.nat({ max: 4 }), evArb), { maxLength: 14 }),
      async (datas, events) => {
        const ctx = sim();
        const f = makeFlow({ run: never });
        const ids = datas.map(() => ctx.random.id("Flow"));
        for (const [i, id] of ids.entries())
          await start(ctx, f, id, datas[i] ?? datas[0] ?? { n: 0, freed: 0, code: "" });
        // the last pick is an id that was never started
        const ghost = ctx.random.id("Flow");
        const trace = await mutate(ctx, f, (S) => {
          const steps: {
            target: string;
            ev: (typeof events)[number][1];
            before: Record<string, Row>;
            after: Record<string, Row>;
          }[] = [];
          for (const [pick, ev] of events) {
            const target = pick >= ids.length ? ghost : (ids[pick] ?? ghost);
            const before = rowsOf(S);
            fire(S, target, ev);
            steps.push({ target, ev, before, after: rowsOf(S) });
          }
          return steps;
        });
        for (const { target, ev, before, after } of trace) {
          expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
          for (const id of Object.keys(before)) {
            const b = before[id];
            const a = after[id];
            if (b === undefined || a === undefined) throw new Error("instance vanished");
            if (id !== target || FINAL.includes(b.state)) {
              expect(a).toEqual(b);
              continue;
            }
            const want = nextOf(f.chart, { state: b.state, data: b.data }, ev);
            expect({ state: a.state, data: a.data }).toEqual(want);
            const moved = want.state !== b.state;
            expect(a.entered).toBe(moved ? b.entered + 1 : b.entered);
            expect(a.attempt).toBe(moved ? 0 : b.attempt);
          }
        }
      },
    ),
    { seed: 1337, numRuns: 25 },
  );
});
