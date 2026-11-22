import { renderRoute } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import { view } from "../modules/shopping/view.store.ts";
import { asJson, served, webRoutes } from "./serve.ts";

const base = view.snapshot();
afterEach(() => view.restore(base));

async function open() {
  const s = await served(3);
  return { ...s, page: await renderRoute("shopping.list", { routes: webRoutes, params: {}, ctx: s.ctx, app: s.app }) };
}

it("shows the empty list, the menu, the tabs and the help", async () => {
  const { page } = await open();
  expect(page.find("shopping.heading").text).toBe("Shopping list");
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  expect(page.find("shopping.staples.trigger").role).toBe("button");
  expect(page.find("shopping.view.tab.toBuy").state).toMatchObject({ selected: true });
  expect(page.focusOrder()).toEqual([
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "shopping.staples.trigger",
    "shopping.view.tab.toBuy",
    "shopping.view.panel.toBuy",
    "shopping.help.button",
  ]);
  page.dispose();
});

it("shows what the API wrote, in its tab, and moves between the tabs", async () => {
  const s = await served(3);
  await s.fetch(asJson("POST", "/api/items", { name: "Milk" }));
  await s.fetch(asJson("POST", "/api/items", { name: "Milk" }));
  await s.fetch(asJson("POST", "/api/items", { name: "Eggs" }));
  const listed = await (await s.fetch(asJson("GET", "/api/items"))).json();
  const [milk, eggs] = listed.results["shopping.items"].value.items;
  await s.fetch(asJson("POST", `/api/items/${eggs.id}/toggle`));
  const page = await renderRoute("shopping.list", { routes: webRoutes, params: {}, ctx: s.ctx, app: s.app });
  expect(page.find(`shopping.name.${milk.id}`).text).toBe("Milk × 2");
  await page.fire("shopping.view.tab.toBuy", { type: "focus" });
  await page.fire("shopping.view.tab.toBuy", { type: "keydown", key: "ArrowRight" });
  expect(view.get("show")).toBe("bought");
  expect(page.find(`shopping.name.${eggs.id}`).text).toBe("Eggs × 1");
  expect(page.find(`shopping.toggle.${eggs.id}`).text).toBe("Back on the list");
  page.dispose();
});

it("opens the help disclosure", async () => {
  const { page } = await open();
  await page.fire("shopping.help.button", { type: "click" });
  expect(page.find("shopping.help.button").state).toMatchObject({ expanded: true });
  expect(page.find("shopping.help.body").text).toContain("raises its quantity");
  page.dispose();
});
