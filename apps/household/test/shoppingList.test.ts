import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import { items } from "../modules/shopping/items.store.ts";
import { routes } from "../modules/shopping/routes.ts";

const base = items.snapshot();
afterEach(() => items.restore(base));

const open = () => renderRoute("shopping.list", { routes, params: {}, ctx: createCtx({ mode: "sim", seed: 3 }) });

it("shows the empty list, the menu, the tabs and the help", async () => {
  const page = await open();
  expect(page.find("shopping.heading").text).toBe("Shopping list");
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  expect(page.find("shopping.staples.trigger").role).toBe("button");
  expect(page.find("shopping.view.tab.toBuy").state).toMatchObject({ selected: true });
  expect(page.focusOrder()).toEqual([
    "shopping.staples.trigger",
    "shopping.view.tab.toBuy",
    "shopping.view.panel.toBuy",
    "shopping.help.button",
  ]);
  page.dispose();
});

it("adds a staple from the menu, twice raises the quantity, and moves it to Bought", async () => {
  const page = await open();
  await page.fire("shopping.staples.trigger", { type: "click" });
  await page.fire("shopping.staples.item.milk", { type: "click" });
  await page.fire("shopping.staples.trigger", { type: "click" });
  await page.fire("shopping.staples.item.milk", { type: "click" });
  const [milk] = items.get("items");
  expect(milk).toMatchObject({ name: "Milk", qty: 2, bought: false });
  if (milk === undefined) return;
  expect(page.find(`shopping.name.${milk.id}`).text).toBe("Milk × 2");
  await page.fire(`shopping.toggle.${milk.id}`, { type: "click" });
  expect(items.get("items")[0]?.bought).toBe(true);
  await page.fire("shopping.view.tab.toBuy", { type: "focus" });
  await page.fire("shopping.view.tab.toBuy", { type: "keydown", key: "ArrowRight" });
  expect(items.get("show")).toBe("bought");
  expect(page.find(`shopping.name.${milk.id}`).text).toBe("Milk × 2");
  await page.fire(`shopping.remove.${milk.id}`, { type: "click" });
  expect(items.get("items")).toEqual([]);
  page.dispose();
});

it("opens the help disclosure", async () => {
  const page = await open();
  await page.fire("shopping.help.button", { type: "click" });
  expect(page.find("shopping.help.button").state).toMatchObject({ expanded: true });
  expect(page.find("shopping.help.body").text).toContain("raises its quantity");
  page.dispose();
});
