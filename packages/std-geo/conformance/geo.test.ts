// Spec: std.geo, Conformance clauses
// Seed 1337
import { createCtx, capabilities } from "@keel/ctx";
import { Position, geo } from "@keel/std-geo";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

const MODES = ["real", "shell", "sim"] as const;
const seeds = fc.integer({ min: 0, max: 2 ** 31 - 1 });
const run = { seed: 1337, numRuns: 50 };

afterEach(() => {
  vi.unstubAllGlobals();
});

async function pos(mode: (typeof MODES)[number], seed: number): Promise<unknown> {
  const r = await geo(createCtx({ mode, seed })).position();
  expect(r.ok).toBe(true);
  return r.ok ? r.value : undefined;
}

test("`capabilities()` lists `geo`, and `geo(ctx)` returns an object with a `position` function under real, shell and sim; the three are distinct objects.", () => {
  expect(capabilities()).toContain("geo");
  const impls = MODES.map((mode) => geo(createCtx({ mode, seed: 1337 })));
  for (const impl of impls) {
    expect(impl).not.toBeNull();
    expect(typeof impl).toBe("object");
    expect(typeof impl.position).toBe("function");
  }
  expect(impls[0]).not.toBe(impls[1]);
  expect(impls[0]).not.toBe(impls[2]);
  expect(impls[1]).not.toBe(impls[2]);
});

test("Under sim, for generated seeds, two ctxs with the same seed give equal positions, and the position parses with `Position`.", async () => {
  await fc.assert(
    fc.asyncProperty(seeds, async (seed) => {
      const a = await pos("sim", seed);
      const b = await pos("sim", seed);
      expect(a).toEqual(b);
      const parsed = Position.parse(a);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.lon).toBeLessThan(180);
        expect(parsed.value.accuracy).toBeGreaterThanOrEqual(1);
        expect(parsed.value.accuracy).toBeLessThan(100);
      }
    }),
    run,
  );
});

test("Under sim, repeated calls on one ctx give equal positions; across generated distinct seeds, the positions are not all equal.", async () => {
  await fc.assert(
    fc.asyncProperty(seeds, async (seed) => {
      const g = geo(createCtx({ mode: "sim", seed }));
      const first = await g.position();
      for (let i = 0; i < 3; i++) expect(await g.position()).toEqual(first);
    }),
    run,
  );
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(seeds, { minLength: 6, maxLength: 12 }), async (ss) => {
      const all = await Promise.all(ss.map((s) => pos("sim", s)));
      expect(new Set(all.map((p) => JSON.stringify(p))).size).toBeGreaterThan(1);
    }),
    run,
  );
});

test("Under real where `navigator.geolocation` is absent, `position()` resolves `err` with code `geo.unavailable` and does not throw; shell does the same.", async () => {
  vi.stubGlobal("navigator", {});
  expect(Reflect.get(Object(globalThis.navigator), "geolocation")).toBeUndefined();
  for (const mode of ["real", "shell"] as const) {
    const r = await geo(createCtx({ mode, seed: 1337 })).position();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("geo.unavailable");
  }
});

test("`geo(ctx)` called twice on one ctx returns the same object (k.ctx lazy resolution).", () => {
  for (const mode of MODES) {
    const ctx = createCtx({ mode, seed: 1337 });
    expect(geo(ctx)).toBe(geo(ctx));
  }
});
