import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { BarChart } from "../src/index.ts";

it("names the chart and hands its code the bars", () => {
  const bars = { bars: [{ name: "April", value: 40 }] };
  const view = render(BarChart, { props: { id: "lib", label: "Rainfall", data: bars } });
  const chart = view.find("lib.chart");
  expect(chart.role).toBe("img");
  expect(chart.name).toBe("Rainfall");
  expect(chart.value).toEqual(bars);
  view.dispose();
});
