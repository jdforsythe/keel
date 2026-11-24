// @vitest-environment happy-dom
// Spec: k.sim, simulate "Each run draws a `SimRun` `{ seed, schedule }` from fast-check, ... creates that sim ctx, and awaits `scenario({ ctx, seed, schedule, run })`."
// Spec: k.sim, net "The n-th `fetch` of the ctx (from 0) takes `net[n]`... It waits `delay` ms on the sim clock, then: `none` runs the route and resolves its response."
// Spec: k.testing, clause "`renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` ... then renders its chain; it resolves when the page is ready."
// No conformance sentence names a `renderRoute` on a `simulate` run's ctx; the nearest text is the `simulate` example of k.sim, whose scenario awaits `renderRoute(..., { ctx })`.
// Seed 1337 (fc.assert below; replay runs one SimRun with the seed 1337).
import { manifest, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { renderRoute, simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const URL_BASE = "https://sim.example.test/page";
const rsContract = contract("rs", { "rs.home": { path: "/rs" } });
const routes = manifest(rsContract, {
  "rs.home": {
    component: (props) => {
      const p = document.createElement("p");
      p.id = "rs.text";
      const data: unknown = props.data;
      p.textContent = String(typeof data === "object" && data !== null ? Reflect.get(data, "text") : "");
      return p;
    },
    loader: loader(rsContract, "rs.home", { output: s.object({ text: s.string() }) }, async (_args, ctx) => {
      const res = await ctx.net.fetch(new Request(URL_BASE));
      return ok({ text: await res.text() });
    }),
  },
});

test("a `renderRoute` on a `simulate` run's ctx with `net: [{ delay: 1 }]` resolves, the page rendered under the simulated delay", async () => {
  let rendered = 0;
  await simulate(
    async ({ ctx, run }) => {
      ctx.net.route(`${URL_BASE}*`, () => new Response("served"));
      const t = await renderRoute("rs.home", { routes, params: {}, ctx });
      expect(t.find("rs.text").text).toBe("served");
      rendered++;
      await run();
      t.dispose();
    },
    {
      law: false,
      replay: { seed: SEED, schedule: { net: [{ delay: 1, fault: "none" }], storage: [], offline: [], plans: {} } },
    },
  );
  expect(rendered).toBe(1);
});

test("a `renderRoute` on a `simulate` run's ctx resolves for any first-request delay", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 60_000 }), async (delay) => {
      let text = "";
      await simulate(
        async ({ ctx, run }) => {
          ctx.net.route(`${URL_BASE}*`, () => new Response("served"));
          const t = await renderRoute("rs.home", { routes, params: {}, ctx });
          text = t.find("rs.text").text;
          await run();
          t.dispose();
        },
        { replay: { seed: SEED, schedule: { net: [{ delay, fault: "none" }], storage: [], offline: [], plans: {} } } },
      );
      expect(text).toBe("served");
    }),
    { seed: 1337, numRuns: 10 },
  );
});
