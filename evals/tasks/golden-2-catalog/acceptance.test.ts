// Hidden acceptance suite for evals/tasks/golden-2-catalog (TASK.md "Acceptance" 3 and 4). pass.ts copies it to
// apps/golden-2/test/__acceptance.test.ts, runs it with the app's vitest config, and deletes it. It reaches the app only
// through what TASK.md pins: the default `topology`, `routes` of modules kitchen and recipes (and of each module the topology places in `api`), route ids, element ids
// and the copy table. Every `renderRoute` and `fire` here also runs the harness's render checks (axe-core, token
// contrast, a11y.json), so a violation in any widget state fails the test that reached it. With `KEEL_TWIN=header`
// (the planted twin, whose title header text is `''`) only the twin test runs, and it must see E1703.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { A11yEntry } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { routes as kitchen } from "../modules/kitchen/routes.ts";
import { routes } from "../modules/recipes/routes.ts";
import { tokens } from "../tokens.ts";
import topology from "../topology.ts";

type L = "en-US" | "de-DE" | "ja-JP";
const LOCALES: readonly L[] = ["en-US", "de-DE", "ja-JP"];
const BASE = "http://localhost";
/** 2026-11-10T09:30:00.000Z. */
const NOW = 1794303000000;
const DAY = 86_400_000;
const JSON_HEADERS = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
const TWIN = process.env.KEEL_TWIN === "header";
const NBSP = " ";

/** The fixture: twelve recipes over three currencies, a day apart from 2026-11-10; every third from the first is a favorite. */
const FIXTURE = [
  ["Apple pie", 75, 1200, "EUR"],
  ["Borscht", 90, 900, "USD"],
  ["Curry udon", 25, 1100, "JPY"],
  ["Dal", 40, 700, "EUR"],
  ["Empanadas", 60, 1500, "USD"],
  ["Focaccia", 120, 600, "JPY"],
  ["Gazpacho", 20, 800, "EUR"],
  ["Hummus", 15, 500, "USD"],
  ["Irish stew", 150, 1400, "JPY"],
  ["Jambalaya", 55, 1300, "EUR"],
  ["Kimchi", 45, 400, "USD"],
  ["Lasagne", 95, 1000, "JPY"],
] as const;
const FAVORITES = ["Apple pie", "Dal", "Gazpacho", "Jambalaya"];

/** TASK.md "Copy", per locale. */
const COPY = {
  "en-US": {
    heading: "Catalog",
    title: "Catalog · Keel",
    price: "Price",
    page1: "Page 1 of 3",
    page3: "Page 3 of 3",
    piePrice: "€12.00",
    pieAdded: "November 10, 2026",
    find: "Find a recipe",
    toast: "Added 2 recipes to the list",
    dismiss: "Dismiss",
    listTab: "Shopping list",
  },
  "de-DE": {
    heading: "Katalog",
    title: "Katalog · Keel",
    price: "Preis",
    page1: "Seite 1 von 3",
    page3: "Seite 3 von 3",
    piePrice: `12,00${NBSP}€`,
    pieAdded: "10. November 2026",
    find: "Rezept finden",
    toast: "2 Rezepte zur Liste hinzugefügt",
    dismiss: "Schließen",
    listTab: "Einkaufsliste",
  },
  "ja-JP": {
    heading: "カタログ",
    title: "カタログ · Keel",
    price: "価格",
    page1: "1 / 3 ページ",
    page3: "3 / 3 ページ",
    piePrice: "€12.00",
    pieAdded: "2026年11月10日",
    find: "レシピを探す",
    toast: "2 件のレシピをリストに追加しました",
    dismiss: "閉じる",
    listTab: "買い物リスト",
  },
} satisfies Record<L, Record<string, string>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const RecipeId = s.id("Recipe");

const hasRoutes = (v: unknown): v is typeof kitchen => isRecord(v) && isRecord(v.routes);

/** The `api` deployable's route table: `routes` of every module the app's topology places in it. */
async function apiRoutes() {
  let table = { ...kitchen.routes };
  for (const name of topology.api?.modules ?? []) {
    if (name === "kitchen") continue;
    const mod: unknown = await import(`../modules/${name}/routes.ts`);
    if (isRecord(mod) && hasRoutes(mod.routes)) table = { ...mod.routes.routes, ...table };
  }
  return manifest(table);
}

/** A fresh api deployable seeded with the fixture, a client sim ctx routed to it, and each title's id. */
async function setup(seed = 1) {
  const serverCtx = createCtx({ mode: "sim", seed: 7 });
  serverCtx.clock.advance(NOW);
  const api = await createApp({ topology, routes: await apiRoutes(), ctx: serverCtx, deployable: "api" });
  const call = (method: string, path: string, body?: unknown): Promise<Response> =>
    api.fetch(
      new Request(new URL(path, BASE).href, {
        method,
        headers: JSON_HEADERS,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  for (const [title, minutes, amount, currency] of FIXTURE) {
    expect((await call("POST", "/api/recipes", { title, minutes, price: { amount, currency } })).status).toBe(200);
    serverCtx.clock.advance(DAY);
  }
  const j: unknown = await (await call("GET", "/api/recipes")).json();
  const results = isRecord(j) && isRecord(j.results) ? j.results["kitchen.recipes"] : undefined;
  const list = isRecord(results) && isRecord(results.value) ? results.value.recipes : undefined;
  const byTitle = new Map<string, string>();
  for (const r of Array.isArray(list) ? list : []) {
    const id = isRecord(r) ? RecipeId.parse(r.id) : undefined;
    if (isRecord(r) && typeof r.title === "string" && id?.ok) byTitle.set(r.title, id.value);
  }
  const id = (title: string): string => {
    const found = byTitle.get(title);
    if (found === undefined) throw new Error(`the api did not list ${title}`);
    return found;
  };
  for (const t of FAVORITES) expect((await call("POST", `/api/recipes/${id(t)}/favorite`, {})).status).toBe(200);
  const ctx = createCtx({ mode: "sim", seed });
  ctx.net.route(new URL("/api/*", location.href).href, (req) => api.fetch(req));
  return { ctx, id, call };
}

const NAMES: readonly string[] = ["label", "alt", "text", "aria", "none"];
const isName = (v: unknown): v is A11yEntry["name"] => typeof v === "string" && NAMES.includes(v);
/** The build's `.keel/a11y.json` (E1702) and the app's tokens (E1804), as the render checks take them. */
const a11yJson = (): Record<string, A11yEntry> => {
  const raw: unknown = JSON.parse(readFileSync(join(process.cwd(), ".keel", "a11y.json"), "utf8"));
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : {};
  const out: Record<string, A11yEntry> = {};
  for (const [id, e] of Object.entries(data))
    if (isRecord(e) && isName(e.name) && typeof e.tag === "string")
      out[id] = { name: e.name, role: typeof e.role === "string" ? e.role : null, tag: e.tag };
  return out;
};
const artifacts = { "a11y.json": a11yJson(), tokens };

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of live.splice(0)) h.dispose();
});
type Env = Awaited<ReturnType<typeof setup>>;
async function open(env: Env, locale: L = "en-US") {
  const r = await renderRoute("recipes.catalog", { routes, params: { locale }, ctx: env.ctx, artifacts });
  live.push(r);
  return r;
}
/** `aria-rowindex` of a table row, read from the DOM: the harness has no state key for it (std.tables). */
const rowIndex = (id: string): string | null => document.getElementById(id)?.getAttribute("aria-rowindex") ?? null;

describe.skipIf(TWIN)("golden-2-catalog acceptance", () => {
  it("the api answers one page of five for a query, in the locale's order", async () => {
    const env = await setup();
    const res = await env.call("GET", "/api/catalog/en-US?sort=price&dir=asc&page=1");
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const entry = isRecord(body) && isRecord(body.results) ? body.results["kitchen.catalog"] : undefined;
    const page = isRecord(entry) && isRecord(entry.value) ? entry.value : {};
    expect(page).toMatchObject({ total: 12, page: 1, pages: 3 });
    const rows = Array.isArray(page.rows) ? page.rows : [];
    expect(rows.map((r) => (isRecord(r) ? r.title : null))).toEqual([
      "Kimchi",
      "Hummus",
      "Focaccia",
      "Dal",
      "Gazpacho",
    ]);
    expect(rows.every((r) => isRecord(r) && typeof r.currency === "string")).toBe(true);
  });

  for (const locale of LOCALES)
    it(`renders recipes.catalog in ${locale} with its copy, title and lang`, async () => {
      const env = await setup();
      const c = COPY[locale];
      const r = await open(env, locale);
      const pie = env.id("Apple pie");
      expect(r.find("recipes.catalog.title").text).toBe(c.heading);
      expect(document.title).toBe(c.title);
      expect(r.find("recipes.shell").id).toBe("recipes.shell");
      expect(document.getElementById("recipes.shell")?.getAttribute("lang")).toBe(locale);
      expect(r.find("recipes.table.header.price").text).toBe(c.price);
      expect(r.find("recipes.table.status").text).toBe(c.page1);
      expect(r.find(`recipes.table.cell.${pie}.price`).text).toBe(c.piePrice);
      expect(r.find(`recipes.table.cell.${pie}.addedOn`).text).toBe(c.pieAdded);
      expect(r.find("recipes.find.input").name).toBe(c.find);
      expect(r.find("recipes.views.tab.list").name).toBe(c.listTab);
      expect(r.find("recipes.catalogLink").role).toBe("link");
    });

  it("Combobox: ArrowDown, ArrowDown, Enter lands on recipes.show with focus on its h1", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.find.input", { type: "focus" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    await r.fire("recipes.find.input", { type: "keydown", key: "Enter" });
    expect(r.route()).toMatchObject({ id: "recipes.show", params: { locale: "en-US", recipeId: env.id("Borscht") } });
    expect(r.find("recipes.show.heading").state.focused).toBe(true);
    expect(r.find("recipes.show.heading").role).toBe("heading");
  });

  it("Combobox: typing filters the options", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.find.input", { type: "focus" });
    await r.fire("recipes.find.input", { type: "input", value: "stew" });
    await r.fire("recipes.find.input", { type: "keydown", key: "ArrowDown" });
    expect(r.find("recipes.find.input").state.active).toBe(`recipes.find.option.${env.id("Irish stew")}`);
  });

  it("Listbox: focus, ArrowDown, Enter sets currency in the URL and the table shows only that currency", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.catalogFilters.button", { type: "click" });
    await r.fire("recipes.currency.list", { type: "focus" });
    await r.fire("recipes.currency.list", { type: "keydown", key: "ArrowDown" });
    await r.fire("recipes.currency.list", { type: "keydown", key: "Enter" });
    expect(r.route()).toMatchObject({ id: "recipes.catalog", search: { currency: "EUR" } });
    for (const [title, , , currency] of FIXTURE) {
      const row = `recipes.table.row.${env.id(title)}`;
      if (currency === "EUR") expect(r.find(row).role).toBe("row");
      else expect(() => r.find(row)).toThrow();
    }
  });

  it("sort: activating sort.price gives aria-sort ascending on header.price with focus still on the link", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.table.sort.price", { type: "focus" });
    await r.fire("recipes.table.sort.price", { type: "click" });
    expect(r.find("recipes.table.header.price").state.sort).toBe("ascending");
    expect(r.find("recipes.table.sort.price").state.focused).toBe(true);
    expect(r.route()).toMatchObject({ search: { sort: "price", dir: "asc" } });
  });

  it("paging: Next twice reaches page 3 with rows aria-rowindex 12 and 13 and focus on status", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.table.next", { type: "focus" });
    await r.fire("recipes.table.next", { type: "click" });
    await r.fire("recipes.table.next", { type: "click" });
    expect(r.route()).toMatchObject({ search: { page: 3 } });
    expect(rowIndex(`recipes.table.row.${env.id("Kimchi")}`)).toBe("12");
    expect(rowIndex(`recipes.table.row.${env.id("Lasagne")}`)).toBe("13");
    expect(r.find("recipes.table.status").text).toBe(COPY["en-US"].page3);
    expect(r.find("recipes.table.status").state.focused).toBe(true);
  });

  it("selection, add, toast: two rows make selectAll mixed; the add Button raises a status toast; dismiss removes it", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire(`recipes.table.select.${env.id("Borscht")}`, { type: "click" });
    await r.fire(`recipes.table.select.${env.id("Dal")}`, { type: "click" });
    expect(r.find("recipes.table.selectAll").state.checked).toBe("mixed");
    await r.fire("recipes.addSelected", { type: "click" });
    expect(r.find("recipes.toaster.status").text).toContain(COPY["en-US"].toast);
    expect(r.find("recipes.toaster.dismiss.toast1").name).toBe(COPY["en-US"].dismiss);
    await r.fire("recipes.toaster.dismiss.toast1", { type: "click" });
    expect(r.find("recipes.toaster.status").text).not.toContain(COPY["en-US"].toast);
    expect(JSON.stringify(r.state()["recipes.list"])).toContain("Borscht");
  });

  it("Tabs: ArrowRight shows the list panel and focusOrder holds one tab", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.views.tab.recipes", { type: "focus" });
    await r.fire("recipes.views.tab.recipes", { type: "keydown", key: "ArrowRight" });
    expect(r.find("recipes.views.tab.list").state.selected).toBe(true);
    expect(r.find("recipes.views.panel.list").role).toBe("tabpanel");
    expect(r.focusOrder().filter((x) => x.startsWith("recipes.views.tab."))).toEqual(["recipes.views.tab.list"]);
  });

  it("alert Dialog: opens with focus on its first button; Escape returns focus to its trigger", async () => {
    const env = await setup();
    const r = await open(env);
    await r.fire("recipes.views.tab.recipes", { type: "focus" });
    await r.fire("recipes.views.tab.recipes", { type: "keydown", key: "ArrowRight" });
    await r.fire("recipes.clear.trigger", { type: "focus" });
    await r.fire("recipes.clear.trigger", { type: "click" });
    expect(r.find("recipes.clear.dialog").role).toBe("alertdialog");
    expect(r.find("recipes.clear.cancel").state.focused).toBe(true);
    await r.fire("recipes.clear.dialog", { type: "keydown", key: "Escape" });
    expect(r.find("recipes.clear.trigger").state.focused).toBe(true);
  });

  it("row Menu: ArrowDown opens it and Enter on its second item opens the de-DE recipe", async () => {
    const env = await setup();
    const r = await open(env);
    const dal = env.id("Dal");
    await r.fire(`recipes.menu.${dal}.trigger`, { type: "focus" });
    await r.fire(`recipes.menu.${dal}.trigger`, { type: "keydown", key: "ArrowDown" });
    await r.fire(`recipes.menu.${dal}.menu`, { type: "keydown", key: "ArrowDown" });
    await r.fire(`recipes.menu.${dal}.menu`, { type: "keydown", key: "Enter" });
    expect(r.route()).toMatchObject({ id: "recipes.show", params: { locale: "de-DE", recipeId: dal } });
  });
});

describe.runIf(TWIN)("golden-2-catalog twin", () => {
  it("an empty header text fails the render with E1703", async () => {
    const env = await setup();
    await expect(
      renderRoute("recipes.catalog", { routes, params: { locale: "en-US" }, ctx: env.ctx, artifacts }),
    ).rejects.toThrow(/E1703/);
  });
});
