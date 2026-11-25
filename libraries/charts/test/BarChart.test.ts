import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { BarChart } from "../src/index.ts";
import { week, words } from "./fixtures.ts";

const props = { id: "spend", label: "Spend per day", summary: "Highest on Thursday, 40.00 €", points: week, text: words };

it("is one picture named by its label and described by its summary", () => {
  const view = render(BarChart, { props });
  const chart = view.find("spend.chart");
  expect(chart.role).toBe("img");
  expect(chart.name).toBe("Spend per day");
  expect(chart.value).toEqual({ points: week });
  expect(view.find("spend.summary").text).toBe("Highest on Thursday, 40.00 €");
});

it("shows the same numbers as a table behind a button", async () => {
  const view = render(BarChart, { props });
  const button = view.find("spend.button");
  expect(button.role).toBe("button");
  expect(button.name).toBe("Show the numbers");
  expect(button.state).toMatchObject({ expanded: false });
  await view.fire("spend.button", { type: "click" });
  expect(view.find("spend.button").state).toMatchObject({ expanded: true });
  const table = view.find("spend.table");
  expect(table.role).toBe("table");
  expect(table.name).toBe("Spend per day");
  expect(view.find("spend.head.name").text).toBe("Day");
  expect(view.find("spend.row.2.name").role).toBe("rowheader");
  expect(view.find("spend.row.2.name").text).toBe("Wed");
  expect(view.find("spend.row.2.value").text).toBe("-3.50 €");
  await view.fire("spend.button", { type: "click" });
  expect(view.find("spend.button").state).toMatchObject({ expanded: false });
});

it("reaches the button by keyboard, before the table", async () => {
  const view = render(BarChart, { props });
  expect(view.focusOrder()).toEqual(["spend.button"]);
});
