import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { LineChart } from "../src/index.ts";
import { week, words } from "./fixtures.ts";

it("is one picture with its summary and its table", async () => {
  const view = render(LineChart, {
    props: { id: "trend", label: "Spend this week", summary: "Up from 12.40 € to 40.00 €", points: week, text: words },
  });
  expect(view.find("trend.chart").role).toBe("img");
  expect(view.find("trend.chart").name).toBe("Spend this week");
  expect(view.find("trend.chart").value).toEqual({ points: week });
  await view.fire("trend.button", { type: "click" });
  expect(view.find("trend.row.3.value").text).toBe("40.00 €");
});
