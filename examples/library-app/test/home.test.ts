import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

it("renders the library's chart under the id the page gives it", async () => {
  const page = await renderRoute("app.home", { routes, params: {} });
  try {
    const chart = page.find("app.rain.chart");
    expect(chart.role).toBe("img");
    expect(chart.name).toBe("Rainfall by month, in millimeters");
    expect(chart.value).toEqual({
      bars: [
        { name: "April", value: 40 },
        { name: "May", value: 65 },
        { name: "June", value: 25 },
      ],
    });
  } finally {
    page.dispose();
  }
});
