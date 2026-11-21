// Spec: k.sim, Conformance "A ctx with an empty schedule gives the same results and observer events as one without."
// Seed: 1337.
import type { CtxEvent, SimCtx } from "@keel/ctx";
import { createCtx, observe } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const empty = { net: [], storage: [], offline: [], plans: {} };

type Op = { kind: "fetch"; path: string } | { kind: "set"; key: string; value: string } | { kind: "get"; key: string };

async function drive(ctx: SimCtx, ops: Op[]) {
  ctx.net.route("https://sim.example.test/*", (req) => new Response(new URL(req.url).pathname));
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  const results: unknown[] = [];
  for (const op of ops) {
    if (op.kind === "fetch") {
      const res = await ctx.net.fetch(new Request(`https://sim.example.test${op.path}`));
      results.push([res.status, await res.text()]);
    } else if (op.kind === "set") results.push(await ctx.storage.set(op.key, op.value));
    else results.push(await ctx.storage.get(op.key));
  }
  results.push(ctx.clock.now(), ctx.random.float(), ctx.net.online());
  return { results, events };
}

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant("fetch" as const), path: fc.constantFrom("/a", "/b", "/missing") }),
  fc.record({
    kind: fc.constant("set" as const),
    key: fc.constantFrom("k1", "k2"),
    value: fc.string({ maxLength: 5 }),
  }),
  fc.record({ kind: fc.constant("get" as const), key: fc.constantFrom("k1", "k2") }),
);

describe("k.sim: empty schedule", () => {
  test("a ctx with an empty schedule gives the same results and observer events as one without", async () => {
    const ops: Op[] = [
      { kind: "set", key: "k1", value: "v" },
      { kind: "fetch", path: "/a" },
      { kind: "get", key: "k1" },
      { kind: "fetch", path: "/missing" },
    ];
    const without = await drive(createCtx({ mode: "sim", seed: SEED }), ops);
    const withEmpty = await drive(createCtx({ mode: "sim", seed: SEED, schedule: empty }), ops);
    expect(withEmpty).toEqual(without);
  });

  test("property: for any operations, an empty schedule and no schedule agree", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: 10 }), fc.integer({ min: 0, max: 1000 }), async (ops, seed) => {
        const without = await drive(createCtx({ mode: "sim", seed }), ops);
        const withEmpty = await drive(createCtx({ mode: "sim", seed, schedule: empty }), ops);
        expect(withEmpty).toEqual(without);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
