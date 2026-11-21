import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

it("names the chart and hands it the loader's bars", async () => {
  const page = await renderRoute("app.home", { routes, params: {} });
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
