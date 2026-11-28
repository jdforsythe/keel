import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";
import { week, words } from "./fixtures.ts";

it("draws the chart as a labelled picture beside its summary, passes axe and takes a box", async () => {
  const app = await serve({
    page: "src/BarChart.tsx",
    props: { id: "spend", label: "Spend this week", summary: "Thursday was highest", points: week, text: words },
  });
  const page = await app.open("/");
  const chart = await page.find("spend.chart");
  expect(chart.role).toBe("img");
  expect(chart.name).toBe("Spend this week");
  expect((await page.find("spend.summary")).text).toBe("Thursday was highest");
  await page.a11y();
  expect((await page.layout("spend.chart")).width).toBeGreaterThan(0);
});
