// Spec: k.sim, Conformance "`drop` and `unavailable` never run the route; `lost` runs it once and the fetch rejects with a `TypeError`; `unavailable` resolves status 503."
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Fault = "none" | "drop" | "lost" | "unavailable";
const URL_A = "https://sim.example.test/a";

function make(faults: Fault[]) {
  const ctx = createCtx({
    mode: "sim",
    seed: SEED,
    schedule: { net: faults.map((fault) => ({ delay: 0, fault })), storage: [], offline: [], plans: {} },
  });
  const calls = { n: 0 };
  ctx.net.route(URL_A, () => {
    calls.n++;
    return new Response("ok");
  });
  const go = async () => {
    try {
      return { ok: true as const, res: await ctx.net.fetch(new Request(URL_A)) };
    } catch (reason) {
      return { ok: false as const, reason };
    }
  };
  return { calls, go };
}

describe("k.sim: net faults", () => {
  test("`drop` never runs the route and the fetch rejects with a `TypeError`", async () => {
    const { calls, go } = make(["drop"]);
    const r = await go();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeInstanceOf(TypeError);
    expect(calls.n).toBe(0);
  });

  test("`unavailable` never runs the route", async () => {
    const { calls, go } = make(["unavailable"]);
    await go();
    expect(calls.n).toBe(0);
  });

  test("`lost` runs the route once and the fetch rejects with a `TypeError`", async () => {
    const { calls, go } = make(["lost"]);
    const r = await go();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeInstanceOf(TypeError);
    expect(calls.n).toBe(1);
  });

  test("`unavailable` resolves status 503", async () => {
    const { go } = make(["unavailable"]);
    const r = await go();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.res.status).toBe(503);
  });

  test("`none` runs the route once and resolves its response", async () => {
    const { calls, go } = make(["none"]);
    const r = await go();
    expect(r.ok).toBe(true);
    if (r.ok) expect(await r.res.text()).toBe("ok");
    expect(calls.n).toBe(1);
  });

  test("property: for any fault series, the route runs once per `none` or `lost` step and never for `drop` or `unavailable`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<Fault>("none", "drop", "lost", "unavailable"), { maxLength: 10 }),
        async (faults) => {
          const { calls, go } = make(faults);
          const results = [];
          for (let i = 0; i < faults.length; i++) results.push(await go());
          expect(calls.n).toBe(faults.filter((f) => f === "none" || f === "lost").length);
          results.forEach((r, i) => {
            const f = faults[i];
            if (f === "drop" || f === "lost") {
              expect(r.ok).toBe(false);
              if (!r.ok) expect(r.reason).toBeInstanceOf(TypeError);
            } else {
              expect(r.ok).toBe(true);
              if (r.ok) expect(r.res.status).toBe(f === "unavailable" ? 503 : 200);
            }
          });
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
