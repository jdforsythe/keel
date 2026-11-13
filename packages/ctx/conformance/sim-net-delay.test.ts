// Spec: k.sim, Conformance "With `net` `[{ delay: 50, fault: 'none' }, { delay: 10, fault: 'none' }]`, two fetches made at time 0 resolve the second at 10 and the first at 50, and a route that records calls sees the second first."
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const none = (delay: number) => ({ delay, fault: "none" as const });

function make(net: { delay: number; fault: "none" | "drop" | "lost" | "unavailable" }[]) {
  const ctx = createCtx({ mode: "sim", seed: SEED, schedule: { net, storage: [], offline: [], plans: {} } });
  const calls: string[] = [];
  ctx.net.route("https://sim.example.test/*", (req) => {
    calls.push(new URL(req.url).pathname);
    return new Response(new URL(req.url).pathname);
  });
  const resolvedAt: Record<string, number> = {};
  const start = (path: string) =>
    ctx.net.fetch(new Request(`https://sim.example.test${path}`)).then((r) => {
      resolvedAt[path] = ctx.clock.now();
      return r;
    });
  return { ctx, calls, resolvedAt, start };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("k.sim: net delay", () => {
  test.skip("two fetches made at time 0 resolve the second at 10 and the first at 50", async () => {
    const { ctx, resolvedAt, start } = make([none(50), none(10)]);
    const first = start("/first");
    const second = start("/second");
    ctx.clock.advance(9);
    await flush();
    expect(resolvedAt).toEqual({});
    ctx.clock.advance(1);
    await flush();
    expect(resolvedAt).toEqual({ "/second": 10 });
    ctx.clock.advance(39);
    await flush();
    expect(resolvedAt).toEqual({ "/second": 10 });
    ctx.clock.advance(1);
    await Promise.all([first, second]);
    expect(resolvedAt).toEqual({ "/second": 10, "/first": 50 });
  });

  test.skip("a route that records calls sees the second first", async () => {
    const { ctx, calls, start } = make([none(50), none(10)]);
    const all = Promise.all([start("/first"), start("/second")]);
    ctx.clock.advance(50);
    await all;
    expect(calls).toEqual(["/second", "/first"]);
  });

  test.skip("the route has not run before the delay has passed", async () => {
    const { ctx, calls, start } = make([none(50)]);
    const p = start("/a");
    ctx.clock.advance(49);
    await flush();
    expect(calls).toEqual([]);
    ctx.clock.advance(1);
    await p;
    expect(calls).toEqual(["/a"]);
  });

  test.skip("property: fetches resolve in delay order, ties in the order made, each at its delay", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 60000 }), { minLength: 1, maxLength: 8 }), async (delays) => {
        const { ctx, calls, resolvedAt, start } = make(delays.map(none));
        const all = Promise.all(delays.map((_, i) => start(`/r${i}`)));
        ctx.clock.advance(60000);
        await all;
        const want = delays
          .map((d, i) => [d, i] as const)
          .sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .map(([, i]) => `/r${i}`);
        expect(calls).toEqual(want);
        delays.forEach((d, i) => expect(resolvedAt[`/r${i}`]).toBe(d));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
