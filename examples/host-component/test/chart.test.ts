import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";
import topology from "../topology.ts";

it("names the chart and hands it the loader's bars", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const app = await createApp({ topology, routes, ctx });
  const page = await renderRoute("app.home", { routes, params: {}, ctx, app });
  expect(page.find("app.home").role).toBe("main");
  const chart = page.find("app.home.chart");
  expect(chart.role).toBe("img");
  expect(chart.name).toBe("Rainfall by month, in millimeters");
  expect(chart.value).toEqual({
    bars: [
      { name: "April", value: 40 },
      { name: "May", value: 65 },
      { name: "June", value: 25 },
    ],
  });
  page.dispose();
});
