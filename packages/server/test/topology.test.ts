import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Topology, createApp, topology } from "../src/index.ts";

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

  it("createApp rejects with E1552 when a module is in two deployables (topology() accepts it)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), adapter, adapter, async (m, a, b) => {
        const t = topology({ x: { modules: [m], adapter: a }, y: { modules: [m, "other"], adapter: b } });
        const routes = manifest({ [`${m}.home`]: { path: `/a/${m}`, component: () => document.createElement("p") } });
        const other = manifest({ "other.home": { path: "/b", component: () => document.createElement("p") } });
        const all = manifest({ ...routes.routes, ...other.routes });
        await expect(
          createApp({ topology: t, routes: all, ctx: createCtx({ mode: "sim", seed: SEED }) }),
        ).rejects.toThrow(/^E1552 module/);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("createApp validates only the served deployable's modules; duplicates still checked on the whole topology", async () => {
    const page = () => document.createElement("p");
    const routes = manifest({ "api.home": { path: "/api", component: page } });
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const t = topology({ web: { modules: ["todos"], adapter: "client" }, api: { modules: ["api"], adapter: "node" } });
    await expect(createApp({ topology: t, routes, ctx, deployable: "api" })).resolves.toBeDefined();
    await expect(createApp({ topology: t, routes, ctx, deployable: "web" })).rejects.toThrow(
      /^E1552 deployable web names unknown module todos/,
    );
    const dup = topology({ web: { modules: ["api"], adapter: "node" }, api: { modules: ["api"], adapter: "node" } });
    await expect(createApp({ topology: dup, routes, ctx, deployable: "api" })).rejects.toThrow(/^E1552 module api/);
  });

  it("throws E1552 for an empty modules list or a bad shape", () => {
    expect(() => topology({ web: { modules: [], adapter: "node" } })).toThrow(/^E1552/);
    const bad = JSON.parse('{"web":{"modules":["a"],"adapter":"lambda"}}');
    expect(() => topology(bad)).toThrow(/^E1552/);
  });

  it("throws E1552 for any deployable name out of its one form, so no two names share a storage file or peer key", () => {
    const form = /^[a-z][a-z0-9-]*$/;
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), (name) => {
        fc.pre(!form.test(name));
        expect(() => topology({ [name]: { modules: ["a"], adapter: "node" } })).toThrow(
          new Error(`E1552 ${name}: name must be lowercase letters, digits and -, starting with a letter`),
        );
      }),
      { seed: SEED },
    );
    for (const name of ["Web", "../x", "API", "my_api"])
      expect(() => topology({ [name]: { modules: ["a"], adapter: "node" } }), name).toThrow(/^E1552 /);
    expect(topology({ "edge-2": { modules: ["a"], adapter: "node" } })).toEqual({
      "edge-2": { modules: ["a"], adapter: "node" },
    });
  });
});
