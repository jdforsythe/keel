// std.jobs: "A `key` equal to a pending job's, or to one of the last 1,000 finished in that queue, returns that job's id
// and stores nothing"; Restart: a job leased when the process stopped runs again, so a job runs at least once.
// Property: under generated enqueue, failure and restart scripts no job is lost and a finished key never runs again.
// Seed 1337
import { createCtx } from "@keel/ctx";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

type Step = { kind: "enqueue"; key: string; delayMs: number } | { kind: "tick"; ms: number } | { kind: "restart" };
const step: fc.Arbitrary<Step> = fc.oneof(
  fc
    .tuple(fc.constantFrom("a", "b", "c", "d"), fc.constantFrom(0, 300))
    .map(([key, delayMs]): Step => ({ kind: "enqueue", key, delayMs })),
  fc.constantFrom(100, 1000).map((ms): Step => ({ kind: "tick", ms })),
  fc.constant<Step>({ kind: "restart" }),
);

test("Generated enqueue, failure and restart scripts never lose a job and never run a finished key again", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(step, { minLength: 1, maxLength: 25 }),
      fc.integer({ min: 0, max: 3 }),
      async (script, fails) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const okRuns: string[] = [];
        const tries = new Map<string, number>();
        const work = job({ input: s.object({ key: s.string() }), attempts: 10 }, async (input) => {
          const n = (tries.get(input.key) ?? 0) + 1;
          tries.set(input.key, n);
          if (n <= fails) return err({ code: "orders.flaky", message: "flaky", data: {} });
          okRuns.push(input.key);
          return ok(null);
        });
        const jobs = queue({ "orders.work": work });
        const ids = new Map<string, unknown>();
        let ac = new AbortController();
        let running = jobs.run(ctx, ac.signal);
        for (const st of script) {
          if (st.kind === "enqueue") {
            const r = await jobs.enqueue(ctx, "orders.work", { key: st.key }, { key: st.key, delayMs: st.delayMs });
            expect(r.ok).toBe(true);
            if (r.ok && ids.has(st.key)) expect(r.value).toBe(ids.get(st.key));
            if (r.ok) ids.set(st.key, r.value);
          } else if (st.kind === "tick") ctx.clock.advance(st.ms);
          else {
            ac.abort();
            await running;
            ac = new AbortController();
            running = jobs.run(ctx, ac.signal);
          }
          await settle();
        }
        for (let i = 0; i < 40; i++) {
          ctx.clock.advance(1000);
          await settle();
        }
        expect([...okRuns].sort()).toEqual([...ids.keys()].sort());
        ac.abort();
        await running;
      },
    ),
    { seed: 1337, numRuns: 60 },
  );
});
