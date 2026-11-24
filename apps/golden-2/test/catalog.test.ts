import { renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import mount from "../identity.ts";
import { routes } from "../modules/recipes/routes.ts";
import { shoppingList } from "../modules/recipes/shoppingList.ts";
import { toasts } from "../modules/recipes/toasts.ts";
import { artifacts } from "./artifacts.ts";
import { catalogApi } from "./catalogFixture.ts";

const NBSP = "\u00a0";
const listBase = shoppingList.snapshot();
const toastBase = toasts.snapshot();
const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of live.splice(0)) h.dispose();
  expect(shoppingList.restore(listBase).ok).toBe(true);
  expect(toasts.restore(toastBase).ok).toBe(true);
});

type Api = Awaited<ReturnType<typeof catalogApi>>;
/** The catalog page from `params.locale`, or from a raw `url`; disposed after the test. */
async function open(api: Api, locale: "en-US" | "de-DE" | "ja-JP" = "en-US", url?: string) {
  const r =
    url === undefined
      ? await renderRoute("recipes.catalog", { routes, params: { locale }, ctx: api.ctx, artifacts, mount })
      : await renderRoute("recipes.catalog", { routes, url, ctx: api.ctx, artifacts, mount });
  live.push(r);
  return r;
}

describe("recipes.catalog in each locale", () => {
  it("shows the first page of five, headers, pager and formatted cells in en-US", async () => {
    const api = await catalogApi();
    const r = await open(api);
    const pie = api.id("Apple pie");
    expect(r.find("recipes.catalog.title").text).toBe("Catalog");
    expect(r.find("recipes.table.table").name).toBe("Recipes in the box");
    expect(r.find("recipes.table.header.price").text).toBe("Price");
    expect(r.find("recipes.table.status").text).toBe("Page 1 of 3");
    expect(r.find(`recipes.table.price.${pie}`).text).toBe("€12.00");
    expect(r.find(`recipes.table.minutes.${pie}`).text).toBe("1 hr, 15 min");
    expect(r.find(`recipes.table.added.${pie}`).text).toBe("November 10, 2026");
    expect(r.find(`recipes.table.favorite.${pie}`).text).toBe("Yes");
    expect(r.find(`recipes.menu.${pie}.trigger`).name).toBe("Actions for Apple pie");
    expect(() => r.find(`recipes.table.row.${api.id("Focaccia")}`)).toThrow();
    expect(r.find("recipes.catalogLink").name).toBe("Catalog");
    r.dispose();
  });
  it("shows the same page in de-DE and ja-JP", async () => {
    const api = await catalogApi();
    const pie = api.id("Apple pie");
    const de = await open(api, "de-DE");
    expect(de.find("recipes.catalog.title").text).toBe("Katalog");
    expect(de.find("recipes.table.header.price").text).toBe("Preis");
    expect(de.find("recipes.table.status").text).toBe("Seite 1 von 3");
    expect(de.find(`recipes.table.price.${pie}`).text).toBe(`12,00${NBSP}€`);
    expect(de.find(`recipes.table.added.${pie}`).text).toBe("10. November 2026");
    expect(de.find("recipes.find.input").name).toBe("Rezept finden");
    de.dispose();
    const ja = await open(api, "ja-JP");
    expect(ja.find("recipes.table.status").text).toBe("1 / 3 ページ");
    expect(ja.find(`recipes.table.minutes.${pie}`).text).toBe("1 時間 15 分");
    expect(ja.find(`recipes.table.added.${pie}`).text).toBe("2026年11月10日");
    expect(ja.find("recipes.views.tab.list").name).toBe("買い物リスト");
    ja.dispose();
  });
});

describe("recipes.catalog table", () => {
  it("sorts by price ascending from the header link and keeps focus on it", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire("recipes.table.sort.price", { type: "focus" });
    await r.fire("recipes.table.sort.price", { type: "click" });
    expect(r.route()).toMatchObject({ id: "recipes.catalog", search: { sort: "price", dir: "asc" } });
    expect(r.find("recipes.table.header.price").state.sort).toBe("ascending");
    expect(r.find("recipes.table.sort.price").state.focused).toBe(true);
    expect(r.find(`recipes.table.row.${api.id("Kimchi")}`).id).toBe(`recipes.table.row.${api.id("Kimchi")}`);
    expect(() => r.find(`recipes.table.row.${api.id("Apple pie")}`)).toThrow();
    await r.fire("recipes.table.sort.price", { type: "click" });
    expect(r.find("recipes.table.header.price").state.sort).toBe("descending");
    expect(r.find(`recipes.table.price.${api.id("Empanadas")}`).text).toBe("$15.00");
    r.dispose();
  });
  it("pages forward twice to page 3 with the last two recipes and focus on the status", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire("recipes.table.next", { type: "focus" });
    await r.fire("recipes.table.next", { type: "click" });
    expect(r.find("recipes.table.status").text).toBe("Page 2 of 3");
    expect(r.find("recipes.table.next").state.focused).toBe(true);
    await r.fire("recipes.table.next", { type: "click" });
    expect(r.route()).toMatchObject({ search: { page: 3 } });
    expect(r.find("recipes.table.status").text).toBe("Page 3 of 3");
    expect(r.find(`recipes.table.row.${api.id("Kimchi")}`).role).toBe("row");
    expect(r.find(`recipes.table.row.${api.id("Lasagne")}`).role).toBe("row");
    expect(r.find("recipes.table.status").state.focused).toBe(true);
    expect(r.location().scrollY).toBe(0);
    r.dispose();
  });
  it("searches titles 300 ms after typing, replacing the history entry", async () => {
    const api = await catalogApi();
    const r = await open(api, "en-US", "/catalog?page=2");
    const before = r.location().entries;
    await r.fire("recipes.search.input", { type: "input", value: "pie" });
    expect(r.route()).toMatchObject({ search: { page: 2 } });
    api.ctx.clock.advance(300);
    await r.settle();
    expect(r.route()).toMatchObject({ id: "recipes.catalog", search: { q: "pie" } });
    expect(r.location().entries).toBe(before);
    expect(r.find("recipes.table.status").text).toBe("Page 1 of 1");
    expect(r.find(`recipes.table.row.${api.id("Apple pie")}`).role).toBe("row");
    r.dispose();
  });
  it("filters favorites through the Show links and keeps the currency", async () => {
    const api = await catalogApi();
    const r = await open(api, "en-US", "/catalog?currency=EUR&page=1");
    await r.fire("recipes.catalog.favorites", { type: "click" });
    expect(r.route()).toMatchObject({ search: { currency: "EUR", favorite: true } });
    expect(r.find("recipes.table.status").text).toBe("Page 1 of 1");
    for (const t of ["Apple pie", "Dal", "Gazpacho", "Jambalaya"])
      expect(r.find(`recipes.table.favorite.${api.id(t)}`).text).toBe("Yes");
    await r.fire("recipes.catalog.all", { type: "click" });
    expect(r.route().search).toEqual({ currency: "EUR" });
    r.dispose();
  });
  it("selecting two rows makes select-all mixed, then adds them to the list with a toast the dismiss removes", async () => {
    const api = await catalogApi();
    const r = await open(api);
    expect(r.find("recipes.addSelected").state.disabled).toBe(true);
    await r.fire(`recipes.table.select.${api.id("Borscht")}`, { type: "click" });
    await r.fire(`recipes.table.select.${api.id("Dal")}`, { type: "click" });
    expect(r.find("recipes.table.selectAll").state.checked).toBe("mixed");
    await r.fire("recipes.addSelected", { type: "click" });
    expect(r.state(shoppingList).recipes.map((x) => x.title)).toEqual(["Borscht", "Dal"]);
    expect(r.find("recipes.toaster.toast.toast1").text).toContain("Added 2 recipes to the list");
    expect(r.find("recipes.toaster.status").text).toContain("Added 2 recipes to the list");
    expect(r.find("recipes.toaster.dismiss.toast1").name).toBe("Dismiss");
    await r.fire("recipes.toaster.dismiss.toast1", { type: "click" });
    expect(() => r.find("recipes.toaster.toast.toast1")).toThrow();
    expect(r.state(toasts).items).toEqual([]);
    r.dispose();
  });
});

describe("recipes.catalog widgets by keyboard", () => {
  it("Combobox: ArrowDown, ArrowDown, Enter opens the second recipe with focus on its heading", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire("recipes.find.input", { type: "focus" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    expect(r.find("recipes.find.input").state.active).toBe(`recipes.find.option.${api.id("Borscht")}`);
    await r.fire("recipes.find.input", { type: "keydown", key: "Enter" });
    expect(r.route()).toMatchObject({ id: "recipes.show", params: { locale: "en-US", recipeId: api.id("Borscht") } });
    expect(r.find("recipes.show.heading").state.focused).toBe(true);
    r.dispose();
  });
  it("Combobox: typing narrows the options and says when none match", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire("recipes.find.input", { type: "focus" });
    await r.fire("recipes.find.input", { type: "input", value: "stew" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    expect(r.find("recipes.find.input").state.active).toBe(`recipes.find.option.${api.id("Irish stew")}`);
    await r.fire("recipes.find.input", { type: "input", value: "zzz" });
    expect(r.find("recipes.find.empty").text).toBe("No recipe matches");
    expect(r.find("recipes.find.input").state.focused).toBe(true);
    r.dispose();
  });
  it("Listbox in the Filters disclosure: focus, ArrowDown, Enter sets currency and the table shows only it", async () => {
    const api = await catalogApi();
    const r = await open(api, "en-US", "/catalog?page=2");
    await r.fire("recipes.catalogFilters.button", { type: "click" });
    expect(r.find("recipes.catalogFilters.button").state.expanded).toBe(true);
    await r.fire("recipes.currency.list", { type: "focus" });
    await r.fire("recipes.currency.list", { type: "keydown", key: "ArrowDown" });
    expect(r.find("recipes.currency.list").state.active).toBe("recipes.currency.option.EUR");
    await r.fire("recipes.currency.list", { type: "keydown", key: "Enter" });
    expect(r.route().search).toEqual({ currency: "EUR" });
    expect(r.find("recipes.table.status").text).toBe("Page 1 of 1");
    for (const t of ["Apple pie", "Dal", "Gazpacho", "Jambalaya"])
      expect(r.find(`recipes.table.price.${api.id(t)}`).text).toMatch(/^€/);
    expect(() => r.find(`recipes.table.row.${api.id("Borscht")}`)).toThrow();
    r.dispose();
  });
  it("Tabs: ArrowRight shows the shopping list and focusOrder holds one tab", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire("recipes.views.tab.recipes", { type: "focus" });
    await r.fire("recipes.views.tab.recipes", { type: "keydown", key: "ArrowRight" });
    expect(r.find("recipes.views.tab.list").state.selected).toBe(true);
    expect(r.find("recipes.views.tab.list").state.focused).toBe(true);
    expect(r.find("recipes.shopping.empty").text).toBe("The shopping list is empty");
    const order = r.focusOrder();
    expect(order.filter((id) => id.startsWith("recipes.views.tab."))).toEqual(["recipes.views.tab.list"]);
    expect(order).not.toContain("recipes.table.next");
    r.dispose();
  });
  it("alert Dialog: opens with focus on its first button, Escape returns focus to the trigger, Clear empties the list", async () => {
    const api = await catalogApi();
    const r = await open(api);
    await r.fire(`recipes.table.select.${api.id("Dal")}`, { type: "click" });
    await r.fire("recipes.addSelected", { type: "click" });
    await r.fire("recipes.views.tab.recipes", { type: "focus" });
    await r.fire("recipes.views.tab.recipes", { type: "keydown", key: "ArrowRight" });
    expect(r.find(`recipes.shopping.item.${api.id("Dal")}`).text).toBe("Dal");
    await r.fire("recipes.clear.trigger", { type: "focus" });
    await r.fire("recipes.clear.trigger", { type: "click" });
    expect(r.find("recipes.clear.dialog").role).toBe("alertdialog");
    expect(r.find("recipes.clear.dialog").name).toBe("Clear the list");
    expect(r.find("recipes.clear.cancel").state.focused).toBe(true);
    await r.fire("recipes.clear.dialog", { type: "keydown", key: "Escape" });
    expect(r.find("recipes.clear.trigger").state.focused).toBe(true);
    expect(r.state(shoppingList).recipes).toHaveLength(1);
    await r.fire("recipes.clear.trigger", { type: "click" });
    await r.fire("recipes.clear.confirm", { type: "click" });
    expect(r.state(shoppingList).recipes).toEqual([]);
    expect(r.find("recipes.shopping.empty").text).toBe("The shopping list is empty");
    r.dispose();
  });
  it("row Menu: ArrowDown opens it, and Enter on its second item opens the de-DE recipe", async () => {
    const api = await catalogApi();
    const r = await open(api);
    const dal = api.id("Dal");
    await r.fire(`recipes.menu.${dal}.trigger`, { type: "focus" });
    await r.fire(`recipes.menu.${dal}.trigger`, { type: "keydown", key: "ArrowDown" });
    expect(r.find(`recipes.menu.${dal}.trigger`).state.expanded).toBe(true);
    expect(r.find(`recipes.menu.${dal}.item.de-DE`).name).toBe("Deutsch (Deutschland)");
    await r.fire(`recipes.menu.${dal}.menu`, { type: "keydown", key: "ArrowDown" });
    expect(r.find(`recipes.menu.${dal}.menu`).state.active).toBe(`recipes.menu.${dal}.item.de-DE`);
    await r.fire(`recipes.menu.${dal}.menu`, { type: "keydown", key: "Enter" });
    expect(r.route()).toMatchObject({ id: "recipes.show", params: { locale: "de-DE", recipeId: dal } });
    expect(r.find("recipes.title").text).toBe("Dal");
    r.dispose();
  });
});
