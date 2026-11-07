// Spec: std.health, clause "A `createApp` (node, sim ctx) serving `routes` answers `GET /health` with `accept: application/json`
// with status 200 and the loader result `ok({ status: 'ok', at })`, where `at` is the sim clock's `now()`. The value parses with `Health`."
// @vitest-environment happy-dom
// Seed 1337. The JSON body's `results['health.status']` is the loader result.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { Health } from "@keel/std-health/Health";
import { routes } from "@keel/std-health/routes";
import fc from "fast-check";
import { expect, test } from "vitest";

test("A `createApp` (node, sim ctx) serving `routes` answers `GET /health` with `accept: application/json` with status 200 and the loader result `ok({ status: 'ok', at })`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 1_000_000 }), async (ms) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      ctx.clock.advance(ms);
      const app = await createApp({
        topology: topology({ api: { modules: ["health"], adapter: "node" } }),
        routes,
        ctx,
        mode: "production",
      });
      const res = await app.fetch(new Request("http://localhost/health", { headers: { accept: "application/json" } }));
      expect(res.status).toBe(200);
      const body: unknown = await res.json();
      const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "health.status");
      expect(Reflect.get(Object(result), "ok")).toBe(true);
      const value: unknown = Reflect.get(Object(result), "value");
      expect(Reflect.get(Object(value), "status")).toBe("ok");
      expect(Reflect.get(Object(value), "at")).toBe(ctx.clock.now());
      const parsed = Health.parse(value);
      expect(parsed.ok).toBe(true);
    }),
    { seed: 1337, numRuns: 20 },
  );
});
