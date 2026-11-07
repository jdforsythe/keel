// Spec: std.timings, clause "A ctx keeps at most 256 names: a new name evicts the least recently updated one."
// @vitest-environment happy-dom
// Seed 1337
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

const routes = manifest({
  "app.home": {
    path: "/",
    component: () => {
      const e = document.createElement("main");
      e.append("home");
      return e;
    },
  },
});

const CAP = 256;

test("A ctx keeps at most 256 names: a new name evicts the least recently updated one", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 299 }), { minLength: 0, maxLength: 700 }), async (seq) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const model = new Map<string, number>();
      let dropped = 0;
      for (const n of seq) {
        const name = `n${n}`;
        await time(ctx, name, () => Promise.resolve(0));
        const prior = model.get(name);
        if (prior === undefined && model.size >= CAP) {
          const oldest = model.keys().next();
          if (!oldest.done) {
            model.delete(oldest.value);
            dropped++;
          }
        }
        model.delete(name);
        model.set(name, (prior ?? 0) + 1);
      }
      const t = timingsOf(ctx);
      expect(Object.keys(t).sort()).toEqual([...model.keys()].sort());
      expect(Object.keys(t).length).toBeLessThanOrEqual(CAP);
      for (const [name, count] of model) expect(t[name]?.count).toBe(count);

      const app = await createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        routes,
        ctx,
        mode: "dev",
      });
      const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
      const body: unknown = await res.json();
      const sections = Reflect.get(Object(body), "sections");
      const section = Reflect.get(Object(sections), "timings.recent");
      const value = Reflect.get(Object(section), "value");
      expect(Reflect.get(Object(value), "dropped")).toBe(dropped);
    }),
    { seed: 1337, numRuns: 15 },
  );
});
