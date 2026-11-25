import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { Sparkline } from "../src/index.ts";
import { words } from "./fixtures.ts";

it("draws one point and lists it", async () => {
  const points = [{ name: "Today", value: 85, shown: "85 ms" }];
  const view = render(Sparkline, {
    props: { id: "load", label: "Load time today", summary: "85 ms", points, text: words },
  });
  expect(view.find("load.chart").role).toBe("img");
  expect(view.find("load.chart").name).toBe("Load time today");
  await view.fire("load.button", { type: "click" });
  expect(view.find("load.row.0.name").text).toBe("Today");
  expect(view.find("load.row.0.value").text).toBe("85 ms");
});

it("renders with no points: an empty picture and a table with no rows", async () => {
  const view = render(Sparkline, {
    props: { id: "none", label: "No load times yet", summary: "No load times yet", points: [], text: words },
  });
  expect(view.find("none.chart").value).toEqual({ points: [] });
  await view.fire("none.button", { type: "click" });
  expect(view.find("none.table").role).toBe("table");
});
