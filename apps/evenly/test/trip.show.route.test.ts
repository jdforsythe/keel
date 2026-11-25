import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import { routes } from "../modules/trip/routes.ts";
import { trip } from "../modules/trip/trip.ts";

const base = trip.snapshot();
afterEach(() => trip.restore(base));

type Page = Awaited<ReturnType<typeof renderRoute>>;

async function addPerson(page: Page, name: string) {
  await page.fire("trip.addPerson.trigger", { type: "click" });
  await page.fire("trip.addPerson.name", { type: "input", value: name });
  await page.fire("trip.addPerson.save", { type: "click" });
}

async function open(): Promise<Page> {
  const page = await renderRoute("trip.show", { routes, params: {}, ctx: createCtx({ mode: "sim", seed: 3 }) });
  await addPerson(page, "Ana");
  await addPerson(page, "Ben");
  await addPerson(page, "Cy");
  return page;
}

async function fill(page: Page, title: string, amount: string, parts: readonly string[]) {
  await page.fire("trip.cost.title", { type: "input", value: title });
  await page.fire("trip.cost.amount", { type: "input", value: amount });
  const ids = trip.get("people").map((p) => p.id);
  for (const [i, value] of parts.entries()) {
    await page.fire(`trip.cost.parts.${ids[i]}`, { type: "input", value });
  }
  await page.fire("trip.cost.add", { type: "submit" });
}

it("a cost of 10.00 euros split evenly three ways leaves 3.34 and 3.33 owed, to the cent", async () => {
  const page = await open();
  await fill(page, "Taxi", "10.00", ["1", "1", "1"]);
  expect(page.find("trip.costs.status").text).toBe("1 costs on this trip.");
  await page.fire("trip.tabs.tab.balances", { type: "click" });
  const shown = trip.get("people").map((p) => page.find(`trip.balances.${p.id}`).text);
  expect(shown).toEqual(["Ana: €6.66", "Ben: -€3.33", "Cy: -€3.33"]);
  page.dispose();
});

it("an uneven split by parts charges each person their parts", async () => {
  const page = await open();
  await fill(page, "Cabin", "90", ["2", "1", "0"]);
  await page.fire("trip.tabs.tab.balances", { type: "click" });
  const shown = trip.get("people").map((p) => page.find(`trip.balances.${p.id}`).text);
  expect(shown).toEqual(["Ana: €30.00", "Ben: -€30.00", "Cy: €0.00"]);
  page.dispose();
});

it("an amount with a fraction a currency has no room for is refused, never rounded", async () => {
  const page = await open();
  await fill(page, "Lunch", "12.505", ["1", "1", "1"]);
  expect(page.find("trip.cost.amount").state.invalid).toBe(true);
  expect(page.find("trip.cost.amount:error").text).toBe(
    "This currency has fewer decimal places. Round the amount to match.",
  );
  expect(trip.get("costs")).toEqual([]);
  page.dispose();
});

it("a currency other than the trip's is refused once a cost exists", async () => {
  const page = await open();
  await fill(page, "Taxi", "10.00", ["1", "1", "1"]);
  await page.fire("trip.cost.currency", { type: "change", value: "USD" });
  await fill(page, "Bus", "5.00", ["1", "1", "1"]);
  expect(trip.get("costs")).toHaveLength(1);
  page.dispose();
});

it("the form reads in order: title, amount, currency, payer, parts, then Add the cost", async () => {
  const page = await open();
  const order = page.focusOrder();
  const at = (id: string) => order.indexOf(id);
  const ids = trip.get("people").map((p) => `trip.cost.parts.${p.id}`);
  expect(at("trip.cost.title")).toBeLessThan(at("trip.cost.amount"));
  expect(at("trip.cost.amount")).toBeLessThan(at("trip.cost.currency"));
  expect(at("trip.cost.currency")).toBeLessThan(at("trip.cost.payer"));
  expect(at("trip.cost.payer")).toBeLessThan(at(ids[0] ?? ""));
  expect(at(ids[2] ?? "")).toBeLessThan(at("trip.cost.add"));
  page.dispose();
});
