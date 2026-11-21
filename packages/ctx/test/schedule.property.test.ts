// Properties for schedules (k.sim). fast-check seed: 1337.
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { NetStep } from "../src/NetStep.schema.ts";
import { Schedule } from "../src/Schedule.schema.ts";
import type { SimCtx } from "../src/SimCtx.ts";
import { createCtx } from "../src/createCtx.ts";
import { observe } from "../src/observe.ts";

const FC = { seed: 1337, numRuns: 100 };

// Small schedules: the plan values are JSON, the windows inside the first second.
const small = fc.record({
  net: fc.array(
    fc.record({
      delay: fc.integer({ min: 0, max: 200 }),
      fault: fc.constantFrom<NetStep["fault"]>("none", "drop", "lost", "unavailable"),
    }),
    { maxLength: 6 },
  ),
  storage: fc.array(fc.constantFrom<"ok" | "fail">("ok", "fail"), { maxLength: 6 }),
  offline: fc.array(fc.record({ at: fc.integer({ min: 0, max: 500 }), ms: fc.integer({ min: 0, max: 200 }) }), {
    maxLength: 3,
  }),
  plans: fc.constant({}),
});

async function trace(ctx: SimCtx): Promise<unknown[]> {
  const out: unknown[] = [];
  observe(ctx, (e) => out.push(e));
  ctx.net.route("https://sim.example.test/*", (req) => {
    out.push(["route", req.url, ctx.clock.now()]);
    return new Response("ok");
  });
  const settle = (p: Promise<unknown>): Promise<unknown> =>
    p.then(
      (v) => (v instanceof Response ? v.status : v),
      (e: unknown) => (e instanceof Error ? e.name : "?"),
    );
  const all = Promise.all([
    ...[0, 1, 2, 3, 4, 5].map((i) => settle(ctx.net.fetch(new Request(`https://sim.example.test/${i}`)))),
    ...[0, 1, 2].map((i) => settle(ctx.storage.set(`k${i % 2}`, `${i}`))),
    ...[0, 1, 2].map((i) => settle(ctx.storage.get(`k${i % 2}`))),
  ]);
  for (let t = 0; t < 1000; t += 25) {
    ctx.clock.advance(25);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    out.push(ctx.net.online());
  }
  out.push(await all);
  return out;
}

describe("Schedule", () => {
  test("property: a generated Schedule round-trips through JSON", () => {
    fc.assert(
      fc.property(gen(Schedule), (schedule) => {
        const back = Schedule.parse(JSON.parse(JSON.stringify(schedule)));
        expect(back).toEqual({ ok: true, value: schedule });
      }),
      FC,
    );
  });

  test("property: two ctxs with one seed and one schedule take the same steps", async () => {
    await fc.assert(
      fc.asyncProperty(small, fc.integer({ min: 0, max: 2 ** 31 - 1 }), async (schedule, seed) => {
        const a = await trace(createCtx({ mode: "sim", seed, schedule }));
        const b = await trace(createCtx({ mode: "sim", seed, schedule: JSON.parse(JSON.stringify(schedule)) }));
        expect(a).toEqual(b);
      }),
      { ...FC, numRuns: 50 },
    );
  });
});
