import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { applyQuery } from "@keel/std-tables";
import { isolate } from "@keel/store";
import { properties, render } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogParams } from "../modules/kitchen/CatalogParams.schema.ts";
import { CatalogResult } from "../modules/kitchen/CatalogResult.schema.ts";
import { CatalogRow } from "../modules/kitchen/CatalogRow.schema.ts";
import { CatalogSearch } from "../modules/kitchen/CatalogSearch.schema.ts";
import { boxStores } from "../modules/kitchen/boxStores.ts";
import { catalogColumns } from "../modules/kitchen/catalogColumns.ts";
import { loadCatalog as loadCatalogApi } from "../modules/kitchen/loadCatalog.server.ts";
import BoxShell from "../modules/recipes/BoxShell.tsx";
import { CatalogData } from "../modules/recipes/CatalogData.schema.ts";
import CatalogPage from "../modules/recipes/CatalogPage.tsx";
import { LocaleParams } from "../modules/recipes/LocaleParams.schema.ts";
import { RecipesText } from "../modules/recipes/RecipesText.schema.ts";
import { ShoppingList } from "../modules/recipes/ShoppingList.schema.ts";
import { ToastRef } from "../modules/recipes/ToastRef.schema.ts";
import { ToastText } from "../modules/recipes/ToastText.schema.ts";
import { Toasts } from "../modules/recipes/Toasts.schema.ts";
import { addToList } from "../modules/recipes/addToList.ts";
import { clearList } from "../modules/recipes/clearList.ts";
import { currencyOptions } from "../modules/recipes/currencyOptions.ts";
import { dismissToast } from "../modules/recipes/dismissToast.ts";
import { kitchen } from "../modules/recipes/kitchen.service.ts";
import { loadCatalog } from "../modules/recipes/loadCatalog.server.ts";
import { raiseToast } from "../modules/recipes/raiseToast.ts";
import { servedLocales } from "../modules/recipes/servedLocales.ts";
import { shoppingList } from "../modules/recipes/shoppingList.ts";
import { toasts } from "../modules/recipes/toasts.ts";
import { CATALOG, catalogApi } from "./catalogFixture.ts";
import { apiApp, apiCtx, asJson } from "./simApi.ts";

type Row = Infer<typeof CatalogRow>;

const en = await RecipesText.load("en-US");

/** A value parsed by `schema`, so format types (titles, dates, ids) carry their brand. */
function parsed<T>(
  schema: { parse(v: unknown): { ok: true; value: T } | { ok: false; error: { message: string } } },
  v: unknown,
): T {
  const r = schema.parse(v);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** The fixture as catalog rows: ids `r1`..`r12`, dated a day apart from 2026-11-10. */
const ROWS: readonly Row[] = CATALOG.map((r, i) =>
  parsed(CatalogRow, {
    id: `r${i + 1}`,
    title: r.title,
    minutes: r.minutes,
    favorite: r.favorite,
    price: { amount: r.amount, currency: r.currency },
    addedOn: `2026-11-${String(10 + i).padStart(2, "0")}`,
    currency: r.currency,
  }),
);
const query = (raw: unknown) => parsed(CatalogSearch, raw);
const titles = (rows: readonly Row[]) => rows.map((r) => r.title);

const listBase = shoppingList.snapshot();
const toastBase = toasts.snapshot();
const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
  expect(shoppingList.restore(listBase).ok).toBe(true);
  expect(toasts.restore(toastBase).ok).toBe(true);
});

describe("CatalogSearch (tableSearch of catalogColumns)", () => {
  it("parses every key optional and refuses unknown sorts, pages below 1 and unknown currencies", () => {
    expect(CatalogSearch.parse({}).ok).toBe(true);
    expect(
      CatalogSearch.parse({ sort: "price", dir: "desc", page: 2, q: "pie", currency: "EUR", favorite: true }).ok,
    ).toBe(true);
    expect(CatalogSearch.parse({ sort: "favorite" }).ok).toBe(false);
    expect(CatalogSearch.parse({ sort: "id" }).ok).toBe(false);
    expect(CatalogSearch.parse({ page: 0 }).ok).toBe(false);
    expect(CatalogSearch.parse({ currency: "XYZ" }).ok).toBe(false);
    expect(CatalogSearch.parse({ q: "x".repeat(201) }).ok).toBe(false);
  });
  it("decodes the URL's strings", () => {
    const r = CatalogSearch.decodeStrings(new URLSearchParams("page=3&favorite=true&currency=JPY"));
    expect(r.ok && r.value).toEqual({ page: 3, favorite: true, currency: "JPY" });
  });
});

describe("applyQuery over the catalog fixture", () => {
  it("pages five rows in input order without a sort, and clamps the page", () => {
    const first = applyQuery(catalogColumns, ROWS, query({}), { pageSize: 5, locale: "en-US" });
    expect(first).toMatchObject({ total: 12, page: 1, pages: 3 });
    expect(titles(first.rows)).toEqual(["Apple pie", "Borscht", "Curry udon", "Dal", "Empanadas"]);
    const last = applyQuery(catalogColumns, ROWS, query({ page: 9 }), { pageSize: 5, locale: "en-US" });
    expect(last.page).toBe(3);
    expect(titles(last.rows)).toEqual(["Kimchi", "Lasagne"]);
  });
  it("sorts prices by amount, minutes numerically and dates in order, either way", () => {
    const opts: { pageSize: number; locale: "en-US" } = { pageSize: 5, locale: "en-US" };
    expect(titles(applyQuery(catalogColumns, ROWS, query({ sort: "price" }), opts).rows)).toEqual([
      "Kimchi",
      "Hummus",
      "Focaccia",
      "Dal",
      "Gazpacho",
    ]);
    expect(titles(applyQuery(catalogColumns, ROWS, query({ sort: "minutes", dir: "desc" }), opts).rows)).toEqual([
      "Irish stew",
      "Focaccia",
      "Lasagne",
      "Borscht",
      "Apple pie",
    ]);
    expect(titles(applyQuery(catalogColumns, ROWS, query({ sort: "addedOn", dir: "desc" }), opts).rows)[0]).toBe(
      "Lasagne",
    );
  });
  it("searches titles ignoring case and filters by currency and favorite", () => {
    const opts: { pageSize: number; locale: "de-DE" } = { pageSize: 5, locale: "de-DE" };
    expect(titles(applyQuery(catalogColumns, ROWS, query({ q: "STEW" }), opts).rows)).toEqual(["Irish stew"]);
    const eur = applyQuery(catalogColumns, ROWS, query({ currency: "EUR" }), opts);
    expect(titles(eur.rows)).toEqual(["Apple pie", "Dal", "Gazpacho", "Jambalaya"]);
    const favUsd = applyQuery(catalogColumns, ROWS, query({ currency: "USD", favorite: true }), opts);
    expect(favUsd).toMatchObject({ rows: [], total: 0, page: 1 });
  });
  it("holds its properties over generated rows and queries (seed 1337)", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const pick = <T>(xs: readonly [T, ...T[]]): T => xs[Math.floor(ctx.random.float() * xs.length)] ?? xs[0];
    const sorts: [undefined, "title", "price", "minutes", "addedOn"] = [
      undefined,
      "title",
      "price",
      "minutes",
      "addedOn",
    ];
    const currencies: ["EUR", "GBP", "JPY", "USD"] = ["EUR", "GBP", "JPY", "USD"];
    const locales: ["en-US", "de-DE", "ja-JP"] = ["en-US", "de-DE", "ja-JP"];
    for (let run = 0; run < 200; run++) {
      const n = Math.floor(ctx.random.float() * 30);
      const rows = Array.from({ length: n }, (_, i) =>
        parsed(CatalogRow, {
          id: `g${i}`,
          title: `${pick(["Soup", "stew", "Salad", "pie", "Äpfel", "ramen"])} ${i}`,
          minutes: 1 + Math.floor(ctx.random.float() * 600),
          favorite: ctx.random.float() < 0.5,
          price: { amount: Math.floor(ctx.random.float() * 5000), currency: pick(currencies) },
          addedOn: `2026-${String(1 + Math.floor(ctx.random.float() * 12)).padStart(2, "0")}-01`,
          currency: pick(currencies),
        }),
      );
      const sort = pick(sorts);
      const raw = {
        ...(sort === undefined ? {} : { sort, dir: pick<"asc" | "desc">(["asc", "desc"]) }),
        ...(ctx.random.float() < 0.3 ? { q: pick(["s", "PIE", "äp", "zz"]) } : {}),
        ...(ctx.random.float() < 0.3 ? { currency: pick(currencies) } : {}),
        ...(ctx.random.float() < 0.3 ? { favorite: ctx.random.float() < 0.5 } : {}),
      };
      const q = query(raw);
      const locale = pick(locales);
      const pageSize = 1 + Math.floor(ctx.random.float() * 7);
      const one = applyQuery(catalogColumns, rows, q, { pageSize, locale });
      expect(applyQuery(catalogColumns, rows, q, { pageSize, locale })).toEqual(one);
      const matching = rows.filter(
        (r) =>
          (q.q === undefined || r.title.toLocaleLowerCase(locale).includes(q.q.toLocaleLowerCase(locale))) &&
          (q.currency === undefined || r.currency === q.currency) &&
          (q.favorite === undefined || r.favorite === q.favorite),
      );
      expect(one.total).toBe(matching.length);
      expect(one.pages).toBe(Math.max(1, Math.ceil(matching.length / pageSize)));
      const all = Array.from({ length: one.pages }, (_, p) =>
        applyQuery(catalogColumns, rows, { ...q, page: p + 1 }, { pageSize, locale }).rows.map((r) => r.id),
      ).flat();
      expect([...all].sort()).toEqual(matching.map((r) => r.id).sort());
      const beyond = applyQuery(catalogColumns, rows, { ...q, page: one.pages + 3 }, { pageSize, locale });
      expect(beyond.page).toBe(one.pages);
    }
  });
});

describe("kitchen.catalog (api)", () => {
  it("answers one page of the box for the query in the locale", async () => {
    const api = await catalogApi();
    const res = await api.app.fetch(asJson("GET", "/api/catalog/de-DE?sort=price&dir=desc&page=2&currency=USD"));
    expect(res.status).toBe(200);
    const body = s
      .object({ results: s.object({ "kitchen.catalog": s.object({ ok: s.literal(true), value: CatalogResult }) }) })
      .parse(await res.json());
    const page = body.ok ? body.value.results["kitchen.catalog"].value : null;
    expect(page).toMatchObject({ total: 4, page: 1, pages: 1 });
    expect(page?.rows.map((r) => r.title)).toEqual(["Empanadas", "Borscht", "Hummus", "Kimchi"]);
  });
  it("runs the kitchen loader over the box store", async () => {
    const sc = scope(() => undefined);
    isolate(sc);
    scopes.push(sc);
    const app = await apiApp(apiCtx(4));
    expect(app).toBeDefined();
    const out = await loadCatalogApi.run(
      {
        params: parsed(CatalogParams, { locale: "ja-JP" }),
        search: query({}),
        url: location.href,
        caller: "c1",
        stores: sc.run(boxStores),
      },
      apiCtx(4),
    );
    expect(out).toEqual({ ok: true, value: { rows: [], total: 0, page: 1, pages: 1 } });
  });
  it("the service names the catalog endpoint", () => {
    expect(kitchen.catalog.path).toBe("/api/catalog/:locale");
  });
});

describe("recipes catalog loader and page", () => {
  it("loadCatalog asks the api for the page and the box, with the copy", async () => {
    const api = await catalogApi();
    const out = await loadCatalog.run(
      {
        params: parsed(LocaleParams, { locale: "en-US" }),
        search: query({ sort: "title", dir: "desc" }),
        url: location.href,
        caller: "c1",
        stores: undefined,
      },
      api.ctx,
    );
    expect(out.ok && out.value.page.rows.map((r) => r.title)[0]).toBe("Lasagne");
    expect(out.ok && out.value.recipes).toHaveLength(12);
    expect(out.ok && out.value.text.catalogHeading).toBe("Catalog");
    expect(api.sent).toEqual(["GET /api/catalog/en-US?sort=title&dir=desc", "GET /api/recipes"]);
  });
  it("CatalogPage renders the table from loader data", () => {
    const page = applyQuery(catalogColumns, ROWS, query({}), { pageSize: 5, locale: "en-US" });
    const data = parsed(CatalogData, { page, recipes: [], text: en });
    const t = render(CatalogPage, { props: { params: { locale: "en-US" }, search: {}, data } });
    expect(t.find("recipes.table.status").text).toBe("Page 1 of 3");
    expect(t.find("recipes.table.price.r1").text).toBe("€12.00");
    expect(t.find("recipes.addSelected").state.disabled).toBe(true);
    t.dispose();
  });
  it("CatalogPage shows the empty row when nothing matches", () => {
    const data = parsed(CatalogData, { page: { rows: [], total: 0, page: 1, pages: 1 }, recipes: [], text: en });
    const t = render(CatalogPage, { props: { params: { locale: "en-US" }, search: { q: "zz" }, data } });
    expect(t.find("recipes.table.none").text).toBe("No recipes");
    t.dispose();
  });
  it("BoxShell shows raised toasts with a dismiss button", async () => {
    const t = render(BoxShell, {
      props: { params: { locale: "de-DE" }, data: { text: await RecipesText.load("de-DE") } },
      state: [[toasts, { next: 2, items: [{ id: "toast1", text: "Hallo", tone: "status" }] }]],
    });
    expect(t.find("recipes.toaster.toast.toast1").text).toContain("Hallo");
    expect(t.find("recipes.toaster.dismiss.toast1").name).toBe("Schließen");
    expect(t.find("recipes.catalogLink").name).toBe("Katalog");
    await t.fire("recipes.toaster.dismiss.toast1", { type: "click" });
    expect(t.state(toasts).items).toEqual([]);
    t.dispose();
  });
});

describe("client stores", () => {
  it("addToList adds each recipe once; clearList empties the list", async () => {
    await properties(addToList, { runs: 100, seed: 1337 });
    await properties(clearList, { runs: 50, seed: 1337 });
  });
  it("raiseToast numbers toasts; dismissToast removes one by id", async () => {
    await properties(raiseToast, { runs: 100, seed: 1337 });
    await properties(dismissToast, { runs: 100, seed: 1337 });
  });
  it("the schemas bound their values", () => {
    expect(ShoppingList.parse({ recipes: [{ id: "r1", title: "Dal" }] }).ok).toBe(true);
    expect(ShoppingList.parse({ recipes: [{ id: "r1", title: "" }] }).ok).toBe(false);
    expect(Toasts.parse({ next: 0, items: [] }).ok).toBe(false);
    expect(ToastText.parse({ text: "" }).ok).toBe(false);
    expect(ToastRef.parse({ id: "toast1" }).ok).toBe(true);
    expect(CatalogParams.parse({ locale: "fr-FR" }).ok).toBe(true);
    expect(CatalogParams.parse({ locale: "xx" }).ok).toBe(false);
    expect(CatalogRow.parse({ ...ROWS[0], currency: "CHF" }).ok).toBe(false);
  });
  it("servedLocales and currencyOptions list the enums in order", () => {
    expect(servedLocales).toEqual(["en-US", "de-DE", "ja-JP"]);
    expect(currencyOptions).toEqual(["EUR", "GBP", "JPY", "USD"]);
  });
});
