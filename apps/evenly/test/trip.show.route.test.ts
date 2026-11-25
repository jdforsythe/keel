import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import { routes } from "../modules/trip/routes.ts";
import { trip } from "../modules/trip/trip.ts";

const base = trip.snapshot();
afterEach(() => trip.restore(base));

async function addPerson(page: Awaited<ReturnType<typeof renderRoute>>, name: string) {
  await page.fire("trip.addPerson.trigger", { type: "click" });
  await page.fire("trip.addPerson.name", { type: "input", value: name });
  await page.fire("trip.addPerson.save", { type: "click" });
}

it("a reader adds two people and a cost, and the Balances tab shows who is owed", async () => {
  const ctx = createCtx({ mode: "sim", seed: 3 });
  const page = await renderRoute("trip.show", { routes, params: {}, ctx });
  expect(page.find("trip.show.title").text).toBe("Your trip");
  await addPerson(page, "Ana");
  await addPerson(page, "Ben");
  await page.fire("trip.costs.title", { type: "input", value: "Taxi" });
  await page.fire("trip.costs.amount", { type: "input", value: "25" });
  await page.fire("trip.costs.add", { type: "click" });
  expect(page.find("trip.costs.status").text).toBe("Cost added.");
  await page.fire("trip.tabs.tab.balances", { type: "click" });
  const lines = trip.get("people").map((p) => page.find(`trip.balances.${p.id}`).text);
  expect(lines).toEqual(["Ana: 12.50 EUR", "Ben: -12.50 EUR"]);
  page.dispose();
});

it("a cost with no title is refused with a message the reader hears", async () => {
  const page = await renderRoute("trip.show", { routes, params: {}, ctx: createCtx({ mode: "sim", seed: 3 }) });
  await addPerson(page, "Ana");
  await page.fire("trip.costs.amount", { type: "input", value: "25" });
  await page.fire("trip.costs.add", { type: "click" });
  expect(page.find("trip.costs.status").text).toContain("Give the cost a title");
  expect(trip.get("costs")).toEqual([]);
  page.dispose();
});

it("the page reads in order: add a person, the tabs, then the cost fields", async () => {
  const page = await renderRoute("trip.show", { routes, params: {}, ctx: createCtx({ mode: "sim", seed: 3 }) });
  const order = page.focusOrder();
  const at = (id: string) => order.indexOf(id);
  expect(at("trip.addPerson.trigger")).toBe(0);
  expect(at("trip.tabs.tab.costs")).toBeGreaterThan(at("trip.addPerson.trigger"));
  expect(at("trip.costs.title")).toBeGreaterThan(at("trip.tabs.tab.costs"));
  expect(at("trip.costs.add")).toBeGreaterThan(at("trip.costs.payer"));
  page.dispose();
});
