// Spec: std.timings, clause "A dev `createApp` whose app ctx ran `time` serves `sections['timings.recent']` as
// `{ doc: TimingsRecent.doc(), value: TimingsRecent.encode({ timings: timingsOf(ctx), dropped: 0 }) }`."
// @vitest-environment happy-dom
// Seed 1337
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { TimingsRecent, time, timingsOf } from "@keel/std-timings";
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

test("A dev `createApp` whose app ctx ran `time` serves `sections['timings.recent']` as `{ doc: TimingsRecent.doc(), value: TimingsRecent.encode({ timings: timingsOf(ctx), dropped: 0 }) }`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 5 }), async (ds) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      for (const d of ds) {
        await time(ctx, "orders.load", () => {
          ctx.clock.advance(d);
          return Promise.resolve(0);
        });
      }
      const app = await createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        routes,
        ctx,
        mode: "dev",
      });
      const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
      expect(res.status).toBe(200);
      const body: unknown = await res.json();
      const secs = Object(Reflect.get(Object(body), "sections"));
      expect(secs["timings.recent"]).toEqual({
        doc: TimingsRecent.doc(),
        value: TimingsRecent.encode({ timings: timingsOf(ctx), dropped: 0 }),
      });
    }),
    { seed: 1337, numRuns: 10 },
  );
});
