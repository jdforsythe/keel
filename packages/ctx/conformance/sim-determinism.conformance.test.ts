// k.ctx: "Simulated implementations are deterministic by seed"
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { createCtx } from "@keel/ctx";

const SEED = 1337;

function sample(seed: number, n: number) {
  const ctx = createCtx({ mode: "sim", seed });
  const uuids: string[] = [];
  const floats: number[] = [];
  for (let i = 0; i < n; i++) {
    uuids.push(ctx.random.uuid());
    floats.push(ctx.random.float());
  }
  return { uuids, floats };
}

describe("k.ctx sim determinism", () => {
  test("same seed yields identical uuid and float sequences", () => {
    expect(sample(SEED, 50)).toEqual(sample(SEED, 50));
  });

  test("property: any seed is reproducible", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        expect(sample(seed, 10)).toEqual(sample(seed, 10));
      }),
    );
  });

  test("different seeds produce different sequences", () => {
    const a = sample(SEED, 20);
    const b = sample(SEED + 1, 20);
    expect(a.uuids).not.toEqual(b.uuids);
    expect(a.floats).not.toEqual(b.floats);
  });

  test("float is always in [0,1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        for (const f of sample(seed, 20).floats) {
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThan(1);
        }
      }),
    );
  });

  test("uuid is a well-formed uuid string", () => {
    for (const u of sample(SEED, 20).uuids) {
      expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  // Assumption: route registration API is unspecified; identical requests on same-seed sim ctx must agree.
  test("sim net.fetch returns a deterministic Response for the same request", async () => {
    const read = async () => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      const res = await ctx.net.fetch(new Request("https://example.test/route"));
      return { status: res.status, body: await res.text() };
    };
    expect(await read()).toEqual(await read());
  });

  test("sim storage is isolated per ctx", async () => {
    const a = createCtx({ mode: "sim", seed: SEED });
    const b = createCtx({ mode: "sim", seed: SEED });
    await a.storage.set("k", "va");
    expect(await a.storage.get("k")).toBe("va");
    expect(await b.storage.get("k")).toBeNull();
  });
});
