// @vitest-environment happy-dom
// k.sim `simulate`: a page renders with `renderRoute` on the run's ctx when its loader's request is delayed on the sim
// clock, as k.sim's own example does; the run's horizon bounds the steps. Seed: 1337.
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { renderRoute, simulate } from "@keel/testing";
import { expect, it } from "vitest";

const ORIGIN = "http://sr.test";
const Out = s.object({ name: s.string() });
const c = contract("sr", { "sr.page": { path: "/sr" } });
const routes = manifest(c, {
  "sr.page": {
    loader: loader(c, "sr.page", { output: Out }, async (_args, ctx) => {
      const res = await ctx.net.fetch(new Request(`${ORIGIN}/name`)).catch(() => null);
      return res === null ? err({ code: "sr.net", message: "no answer", data: {} }) : ok({ name: await res.text() });
    }),
    component: () => {
      const p = document.createElement("p");
      p.id = "sr.out";
      p.textContent = "page";
      return p;
    },
  },
});

const schedule = (delay: number) => ({
  seed: 0,
  schedule: { net: [{ delay, fault: "none" as const }], storage: [], offline: [], plans: {} },
});

it("renders a page whose first request is delayed 1 ms, the clock stepped to the answer", async () => {
  await simulate(
    async ({ ctx, run }) => {
      ctx.net.route(`${ORIGIN}/name`, () => new Response("Milk"));
      const t = await renderRoute("sr.page", { routes, ctx });
      expect([t.route().pending, ctx.clock.now()]).toEqual([false, 1]);
      await run();
      t.dispose();
    },
    { replay: schedule(1) },
  );
});

it("renders under every generated net schedule", async () => {
  const out = await simulate(
    async ({ ctx, run }) => {
      ctx.net.route(`${ORIGIN}/name`, () => new Response("Milk"));
      const t = await renderRoute("sr.page", { routes, ctx });
      expect(t.route().pending).toBe(false);
      await run();
      t.dispose();
    },
    { runs: 20, seed: 1337 },
  );
  expect(out.runs).toBe(20);
});
