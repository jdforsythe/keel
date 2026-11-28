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

it("renders the looks library's card with its badge and a switch, and a scheme select", async () => {
  const page = await renderRoute("app.home", { routes, params: {} });
  try {
    expect(page.find("app.alerts.title").text).toBe("Rain alerts");
    expect(page.find("app.alerts.badge.text").text).toBe("Beta");
    const toggle = page.find("app.alerts.toggle.switch");
    expect(toggle.role).toBe("switch");
    expect(toggle.name).toBe("Alert me when it rains");
    expect(toggle.state.checked).toBe(false);
    await page.fire("app.alerts.toggle.switch", { type: "click" });
    expect(page.find("app.alerts.toggle.switch").state.checked).toBe(true);
    expect(page.find("app.scheme").role).toBe("combobox");
  } finally {
    page.dispose();
  }
});
