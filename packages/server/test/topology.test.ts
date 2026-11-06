import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Topology, topology } from "../src/index.ts";

const SEED = 1337;
const adapter = fc.constantFrom("node" as const, "static" as const, "client" as const);
const validDef = fc
  .uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/), { minLength: 1, maxLength: 12 })
  .chain((mods) =>
    fc.integer({ min: 1, max: mods.length }).chain((n) =>
      fc
        .tuple(
          fc.shuffledSubarray(mods, { minLength: mods.length, maxLength: mods.length }),
          fc.array(adapter, { minLength: n, maxLength: n }),
        )
        .map(([shuffled, adapters]) => {
          const def: Record<string, { modules: string[]; adapter: "node" | "static" | "client" }> = {};
          adapters.forEach((a, i) => {
            const chunk = shuffled.filter((_, j) => j % adapters.length === i);
            if (chunk.length > 0) def[`d${i}`] = { modules: chunk, adapter: a };
          });
          return def;
        }),
    ),
  );

describe("topology", () => {
  it("round-trips any valid definition, frozen", () => {
    fc.assert(
      fc.property(validDef, (def) => {
        const t: Topology = topology(def);
        expect(t).toEqual(def);
        expect(Object.isFrozen(t)).toBe(true);
        for (const d of Object.values(t)) expect(Object.isFrozen(d.modules)).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("throws E1552 when a module is in two deployables", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}$/), adapter, adapter, (m, a, b) => {
        expect(() => topology({ x: { modules: [m], adapter: a }, y: { modules: [m, "other"], adapter: b } })).toThrow(
          /^E1552/,
        );
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("throws E1552 for an empty modules list or a bad shape", () => {
    expect(() => topology({ web: { modules: [], adapter: "node" } })).toThrow(/^E1552/);
    const bad = JSON.parse('{"web":{"modules":["a"],"adapter":"lambda"}}');
    expect(() => topology(bad)).toThrow(/^E1552/);
  });
});
