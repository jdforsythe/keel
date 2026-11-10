// Hidden acceptance suite for evals/tasks/golden-2 (TASK.md "Acceptance" 6). pass.ts copies it to
// apps/golden-2/test/__acceptance.test.ts, runs it with the app's vitest config, and deletes it. It reaches the app only
// through what TASK.md pins: the default `topology`, `routes` of modules kitchen and recipes, route ids, element ids,
// and the `RecipesText` set. The strings are RFC 0079's eval table; `␣` there is U+00A0 (`NBSP` here).
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp, topology as testTopology } from "@keel/server";
import { formatMoney } from "@keel/std-money";
import { type A11yNode, renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes as kitchen } from "../modules/kitchen/routes.ts";
import { RecipesText } from "../modules/recipes/RecipesText.schema.ts";
import { routes } from "../modules/recipes/routes.ts";
import topology from "../topology.ts";

type Recipe = { id: string; title: string; minutes: number; favorite: boolean };
type L = "en-US" | "de-DE" | "ja-JP";
type Currency = "EUR" | "GBP" | "JPY" | "USD";

const LOCALES: readonly L[] = ["en-US", "de-DE", "ja-JP"];
const NBSP = " ";
const BASE = "http://localhost";
/** 2026-11-10T09:30:00.000Z. */
const NOW = 1794303000000;
const JSON_HEADERS = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

// The first `import()` of a locale file reads the disk, longer than `renderRoute` waits for a loader; load each once.
await Promise.all(LOCALES.map((l) => RecipesText.load(l)));

/** RFC 0079 "Exit proof and golden-2", per locale. */
const TABLE = {
  "en-US": {
    indexTitle: "Recipes · Keel",
    showTitle: "Miso soup · Recipes",
    newTitle: "New recipe · Keel",
    home: "Recipes",
    newLink: "New recipe",
    listTitle: "Recipes",
    favorites: "Favorites",
    countAll: "2 recipes",
    countFavorites: "1 recipe",
    pastaPrice: "€12.50",
    soupPrice: "¥1,800",
    added: "November 10, 2026",
    pastaMinutes: "30 min",
    soupMinutes: "1 hr, 30 min",
    notFavorite: "Not favorite",
    toggleFavorite: "Toggle favorite",
    addedOn: "Added November 10, 2026",
    titleRule: "1 to 80 characters on one line",
    titleTaken: "Already in the box",
  },
  "de-DE": {
    indexTitle: "Rezepte · Keel",
    showTitle: "Miso soup · Rezepte",
    newTitle: "Neues Rezept · Keel",
    home: "Rezepte",
    newLink: "Neues Rezept",
    listTitle: "Rezepte",
    favorites: "Favoriten",
    countAll: "2 Rezepte",
    countFavorites: "1 Rezept",
    pastaPrice: `12,50${NBSP}€`,
    soupPrice: `1.800${NBSP}¥`,
    added: "10. November 2026",
    pastaMinutes: "30 Min.",
    soupMinutes: "1 Std., 30 Min.",
    notFavorite: "Kein Favorit",
    toggleFavorite: "Favorit umschalten",
    addedOn: "Hinzugefügt am 10. November 2026",
    titleRule: "1 bis 80 Zeichen in einer Zeile",
    titleTaken: "Schon in der Sammlung",
  },
  "ja-JP": {
    indexTitle: "レシピ · Keel",
    showTitle: "Miso soup · レシピ",
    newTitle: "新しいレシピ · Keel",
    home: "レシピ",
    newLink: "新しいレシピ",
    listTitle: "レシピ",
    favorites: "お気に入り",
    countAll: "2 件のレシピ",
    countFavorites: "1 件のレシピ",
    pastaPrice: "€12.50",
    soupPrice: "￥1,800",
    added: "2026年11月10日",
    pastaMinutes: "30 分",
    soupMinutes: "1 時間 30 分",
    notFavorite: "お気に入りではありません",
    toggleFavorite: "お気に入りを切り替え",
    addedOn: "2026年11月10日に追加",
    titleRule: "1〜80文字で、1行で入力してください",
    titleTaken: "すでに登録されています",
  },
} as const;

const SWITCHER = { "en-US": "English (United States)", "de-DE": "Deutsch (Deutschland)", "ja-JP": "日本語 (日本)" };

const RecipeId = s.id("Recipe");

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A fresh api deployable over its own sim ctx at `NOW`, a client sim ctx routed to it, and the requests it sent. */
async function setup(seed = 1) {
  const serverCtx = createCtx({ mode: "sim", seed: 7 });
  serverCtx.clock.advance(NOW);
  const api = await createApp({ topology, routes: kitchen, ctx: serverCtx, deployable: "api" });
  const call = (method: string, path: string, body?: unknown): Promise<Response> =>
    api.fetch(
      new Request(new URL(path, BASE).href, {
        method,
        headers: JSON_HEADERS,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  const recipes = async (): Promise<Recipe[]> => {
    const j: unknown = await (await call("GET", "/api/recipes")).json();
    const results = isRecord(j) && isRecord(j.results) ? j.results["kitchen.recipes"] : undefined;
    const value = isRecord(results) && isRecord(results.value) ? results.value.recipes : undefined;
    return Array.isArray(value) ? value.filter((r): r is Recipe => isRecord(r) && typeof r.id === "string") : [];
  };
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    return api.fetch(req);
  });
  return { api, call, recipes, ctx, sent };
}

/** The RFC fixture: Pasta bake (30 min, EUR 12.50, favorite) and Miso soup (90 min, JPY 1800); returns their ids. */
async function seeded(env: Awaited<ReturnType<typeof setup>>) {
  const pastaBody = { title: "Pasta bake", minutes: 30, price: { amount: 1250, currency: "EUR" } };
  const soupBody = { title: "Miso soup", minutes: 90, price: { amount: 1800, currency: "JPY" } };
  expect((await env.call("POST", "/api/recipes", pastaBody)).status).toBe(200);
  expect((await env.call("POST", "/api/recipes", soupBody)).status).toBe(200);
  const all = await env.recipes();
  const pasta = RecipeId.parse(all.find((r) => r.title === "Pasta bake")?.id);
  const soup = RecipeId.parse(all.find((r) => r.title === "Miso soup")?.id);
  if (!pasta.ok || !soup.ok) throw new Error("the api did not list the fixture");
  expect((await env.call("POST", `/api/recipes/${pasta.value}/favorite`, {})).status).toBe(200);
  return { pasta: pasta.value, soup: soup.value };
}

const ids = (nodes: readonly A11yNode[], out: string[] = []): string[] => {
  for (const n of nodes) {
    out.push(n.id);
    ids(n.children, out);
  }
  return out;
};

describe("golden-2 acceptance", () => {
  it("index lists the api's recipes; the favorites filter keeps only favorites", async () => {
    const env = await setup();
    const { pasta, soup } = await seeded(env);
    const all = await renderRoute("recipes.index", { routes, params: { locale: "en-US" }, ctx: env.ctx });
    expect(all.find(`recipes.link.${pasta}`).text).toBe("Pasta bake");
    expect(all.find(`recipes.minutes.${soup}`).text).toBe("1 hr, 30 min");
    all.dispose();
    const favs = await renderRoute("recipes.index", {
      routes,
      params: { locale: "en-US" },
      search: { only: "favorites" },
      ctx: env.ctx,
    });
    const shown = ids(favs.a11y());
    expect(shown).toContain(`recipes.link.${pasta}`);
    expect(shown).not.toContain(`recipes.link.${soup}`);
    favs.dispose();
  });

  it("the show page toggles favorite through its Form and revalidates", async () => {
    const env = await setup();
    const { soup } = await seeded(env);
    const r = await renderRoute("recipes.show", { routes, params: { locale: "en-US", recipeId: soup }, ctx: env.ctx });
    expect(r.find("recipes.title").text).toBe("Miso soup");
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    await r.fire("recipes.toggleFavorite", { type: "click" });
    await r.settle();
    expect(r.find("recipes.favorite").text).toBe("Favorite");
    expect((await env.recipes()).find((x) => x.id === soup)?.favorite).toBe(true);
    r.dispose();
  });

  it("an unknown recipe renders the errorElement", async () => {
    const env = await setup();
    const missing = createCtx({ mode: "sim", seed: 99 }).random.id("Recipe");
    const r = await renderRoute("recipes.show", {
      routes,
      params: { locale: "en-US", recipeId: missing },
      ctx: env.ctx,
    });
    expect(r.find("recipes.error").text.length).toBeGreaterThan(0);
    r.dispose();
  });

  it("a guest is redirected from recipes.new to recipes.index in the same locale", async () => {
    for (const [locale, url] of [
      ["en-US", "/"],
      ["de-DE", "/de-DE"],
    ] as const) {
      const env = await setup();
      await env.ctx.storage.set("recipes.guest", "1");
      const r = await renderRoute("recipes.new", { routes, params: { locale }, ctx: env.ctx });
      expect(r.route()).toMatchObject({ id: "recipes.index", params: { locale } });
      expect(routes.href("recipes.index", { locale })).toBe(url);
      r.dispose();
    }
  });

  it("new recipe: invalid submit sends nothing; a duplicate title shows the api's field error; a valid one is listed", async () => {
    const env = await setup();
    await seeded(env);
    const r = await renderRoute("recipes.new", { routes, params: { locale: "en-US" }, ctx: env.ctx });
    const before = env.sent.length;
    await r.fire("recipes.save", { type: "click" });
    expect(env.sent.slice(before).filter((x) => x.startsWith("POST"))).toEqual([]);
    expect(r.find("recipes.draft:title").state.focused).toBe(true);
    await r.fire("recipes.draft:title", { type: "input", value: "pasta BAKE" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "20" });
    await r.fire("recipes.draft:price.amount", { type: "input", value: "999" });
    await r.fire("recipes.save", { type: "click" });
    expect(env.sent).toContain("POST /api/recipes");
    expect(r.find("recipes.draft:title:error").text.length).toBeGreaterThan(0);
    await r.fire("recipes.draft:title", { type: "input", value: "Stew" });
    await r.fire("recipes.save", { type: "click" });
    await r.settle();
    expect(r.route().id).toBe("recipes.index");
    const stew = (await env.recipes()).find((x) => x.title === "Stew");
    expect(stew?.minutes).toBe(20);
    expect(r.find(`recipes.link.${stew?.id ?? ""}`).text).toBe("Stew");
    expect(r.find(`recipes.price.${stew?.id ?? ""}`).text).toBe("€9.99");
    r.dispose();
  });

  for (const locale of LOCALES) {
    const want = TABLE[locale];

    it(`${locale}: the index shows the table's copy, prices, dates, durations, title and language`, async () => {
      const env = await setup();
      const { pasta, soup } = await seeded(env);
      const r = await renderRoute("recipes.index", { routes, params: { locale }, ctx: env.ctx });
      expect(document.title).toBe(want.indexTitle);
      expect(document.documentElement.lang).toBe(locale);
      expect(r.find("recipes.home").name).toBe(want.home);
      expect(r.find("recipes.newLink").name).toBe(want.newLink);
      expect(r.find("recipes.list.title").text).toBe(want.listTitle);
      expect(r.find("recipes.filter.favorites").name).toBe(want.favorites);
      expect(r.find("recipes.count").text).toBe(want.countAll);
      expect(r.find(`recipes.price.${pasta}`).text).toBe(want.pastaPrice);
      expect(r.find(`recipes.price.${soup}`).text).toBe(want.soupPrice);
      expect(r.find(`recipes.added.${pasta}`).text).toBe(want.added);
      expect(r.find(`recipes.added.${soup}`).text).toBe(want.added);
      expect(r.find(`recipes.minutes.${pasta}`).text).toBe(want.pastaMinutes);
      expect(r.find(`recipes.minutes.${soup}`).text).toBe(want.soupMinutes);
      for (const other of LOCALES) expect(r.find(`recipes.locale.${other}`).name).toBe(SWITCHER[other]);
      r.dispose();
      const favs = await renderRoute("recipes.index", {
        routes,
        params: { locale },
        search: { only: "favorites" },
        ctx: env.ctx,
      });
      expect(favs.find("recipes.count").text).toBe(want.countFavorites);
      favs.dispose();
    });

    it(`${locale}: Miso soup's page shows the table's copy, title and language`, async () => {
      const env = await setup();
      const { soup } = await seeded(env);
      const r = await renderRoute("recipes.show", { routes, params: { locale, recipeId: soup }, ctx: env.ctx });
      expect(document.title).toBe(want.showTitle);
      expect(document.documentElement.lang).toBe(locale);
      expect(r.find("recipes.favorite").text).toBe(want.notFavorite);
      expect(r.find("recipes.toggleFavorite").name).toBe(want.toggleFavorite);
      expect(r.find("recipes.addedOn").text).toBe(want.addedOn);
      r.dispose();
    });

    it(`${locale}: the new-recipe page's title, an empty title's rule and a duplicate's text`, async () => {
      const env = await setup();
      await seeded(env);
      const r = await renderRoute("recipes.new", { routes, params: { locale }, ctx: env.ctx });
      expect(document.title).toBe(want.newTitle);
      expect(document.documentElement.lang).toBe(locale);
      await r.fire("recipes.save", { type: "click" });
      expect(r.find("recipes.draft:title:error").text).toBe(want.titleRule);
      await r.fire("recipes.draft:title", { type: "input", value: "miso SOUP" });
      await r.fire("recipes.draft:minutes", { type: "input", value: "10" });
      await r.fire("recipes.draft:price.amount", { type: "input", value: "100" });
      await r.fire("recipes.save", { type: "click" });
      expect(r.find("recipes.draft:title:error").text).toBe(want.titleTaken);
      r.dispose();
    });
  }

  it("a client navigation keeps title and language current; the switcher goes to the other locale's index", async () => {
    const env = await setup();
    const { soup } = await seeded(env);
    const r = await renderRoute("recipes.index", { routes, params: { locale: "de-DE" }, ctx: env.ctx });
    await r.navigate(routes.href("recipes.show", { locale: "de-DE", recipeId: soup }));
    expect(document.title).toBe("Miso soup · Rezepte");
    expect(document.documentElement.lang).toBe("de-DE");
    expect(r.find("recipes.home").name).toBe("Rezepte");
    await r.fire("recipes.locale.ja-JP", { type: "click" });
    await r.settle();
    expect(r.route()).toMatchObject({ id: "recipes.index", params: { locale: "ja-JP" } });
    expect(document.title).toBe("レシピ · Keel");
    expect(document.documentElement.lang).toBe("ja-JP");
    r.dispose();
  });

  it("links leave out the en-US prefix", () => {
    const id = createCtx({ mode: "sim", seed: 5 }).random.id("Recipe");
    expect(routes.href("recipes.index", { locale: "en-US" })).toBe("/");
    expect(routes.href("recipes.index", { locale: "de-DE" })).toBe("/de-DE");
    expect(routes.href("recipes.index", { locale: "ja-JP" })).toBe("/ja-JP");
    expect(routes.href("recipes.show", { locale: "en-US", recipeId: id })).toBe(`/recipes/${id}`);
    expect(routes.href("recipes.show", { locale: "de-DE", recipeId: id })).toBe(`/de-DE/recipes/${id}`);
  });

  it("for 20 generated prices posted through the api, the index shows formatMoney in each locale", async () => {
    const env = await setup();
    const random = createCtx({ mode: "sim", seed: 2079 }).random;
    const currencies: readonly Currency[] = ["EUR", "GBP", "JPY", "USD"];
    const prices = new Map<string, { amount: number; currency: Currency }>();
    for (let i = 0; i < 20; i++) {
      const scale = 10 ** Math.floor(random.float() * 13);
      const amount = Math.round((random.float() * 2 - 1) * scale);
      const currency = currencies[Math.floor(random.float() * currencies.length)] ?? "EUR";
      const title = `Dish ${i}`;
      prices.set(title, { amount, currency });
      expect((await env.call("POST", "/api/recipes", { title, minutes: 5, price: { amount, currency } })).status).toBe(
        200,
      );
    }
    const all = await env.recipes();
    for (const locale of LOCALES) {
      const r = await renderRoute("recipes.index", { routes, params: { locale }, ctx: env.ctx });
      for (const recipe of all) {
        const m = prices.get(recipe.title);
        expect(m).toBeDefined();
        if (m !== undefined) expect(r.find(`recipes.price.${recipe.id}`).text).toBe(formatMoney(m, locale));
      }
      r.dispose();
    }
  });

  it("server documents: copy, title and <html lang> per locale; 308 for a prefixed en-US URL; 404 for other locales; island state", async () => {
    const env = await setup();
    const { pasta, soup } = await seeded(env);
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(`${BASE}/api/*`, (req) => env.api.fetch(req));
    const web = await createApp({
      topology: testTopology({ web: { modules: ["recipes"], adapter: "node" } }),
      routes,
      ctx,
    });
    const get = async (path: string) => {
      const res = await web.fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
      const html = await res.text();
      return {
        status: res.status,
        location: res.headers.get("location"),
        html,
        doc: new DOMParser().parseFromString(html, "text/html"),
      };
    };
    const text = (doc: Document, id: string): string | undefined => doc.getElementById(id)?.textContent ?? undefined;

    for (const [locale, path] of [
      ["en-US", "/"],
      ["de-DE", "/de-DE"],
    ] as const) {
      const want = TABLE[locale];
      const page = await get(path);
      expect(page.status).toBe(200);
      expect(page.html).toContain(`<html lang="${locale}">`);
      expect(page.html).toContain(`<title>${want.indexTitle}</title>`);
      expect(page.doc.getElementById("recipes.shell")?.getAttribute("lang")).toBe(locale);
      expect(text(page.doc, "recipes.home")).toBe(want.home);
      expect(text(page.doc, "recipes.count")).toBe(want.countAll);
      expect(text(page.doc, `recipes.price.${pasta}`)).toBe(want.pastaPrice);
      expect(text(page.doc, `recipes.price.${soup}`)).toBe(want.soupPrice);
      expect(text(page.doc, `recipes.added.${soup}`)).toBe(want.added);
      expect(text(page.doc, `recipes.minutes.${soup}`)).toBe(want.soupMinutes);
      for (const [other, href] of [
        ["en-US", "/"],
        ["de-DE", "/de-DE"],
        ["ja-JP", "/ja-JP"],
      ] as const) {
        const link = page.doc.getElementById(`recipes.locale.${other}`);
        expect(link?.textContent).toBe(SWITCHER[other]);
        expect(link?.getAttribute("lang")).toBe(other);
        expect(link?.getAttribute("href")).toBe(href);
      }
    }

    const ja = await get(`/ja-JP/recipes/${soup}`);
    expect(ja.status).toBe(200);
    expect(ja.html).toContain('<html lang="ja-JP">');
    expect(ja.html).toContain(`<title>${TABLE["ja-JP"].showTitle}</title>`);
    expect(text(ja.doc, "recipes.addedOn")).toBe(TABLE["ja-JP"].addedOn);
    expect(text(ja.doc, "recipes.favorite")).toBe(TABLE["ja-JP"].notFavorite);

    const root = await get("/en-US");
    expect(root.status).toBe(308);
    expect(root.location).toBe("/");
    const show = await get(`/en-US/recipes/${soup}`);
    expect(show.status).toBe(308);
    expect(show.location).toBe(`/recipes/${soup}`);
    expect((await get("/fr-FR")).status).toBe(404);

    const island = await get(`/de-DE/recipes/${soup}`);
    const state = island.doc.getElementById("k-state")?.textContent ?? "";
    expect(state).toContain("Favorit umschalten");
    expect(state).not.toContain("Toggle favorite");
    expect(state).not.toContain("お気に入りを切り替え");
  });
});
