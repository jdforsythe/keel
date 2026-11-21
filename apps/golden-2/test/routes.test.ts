import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Box } from "../modules/kitchen/Box.schema.ts";
import { recipes } from "../modules/recipes/recipes.contract.ts";
import { routes } from "../modules/recipes/routes.ts";
import { asJson, draft, simApi } from "./simApi.ts";

type Api = Awaited<ReturnType<typeof simApi>>;

/** Add `title` through the api and return the id it minted. */
async function seed(api: Api, title: string, minutes: number, amount = 1250, currency = "EUR"): Promise<string> {
  await api.app.fetch(asJson("POST", "/api/recipes", draft(title, minutes, amount, currency)));
  const res = await api.app.fetch(asJson("GET", "/api/recipes"));
  const body: unknown = await res.json();
  const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
  const entry =
    typeof results === "object" && results !== null && "kitchen.box" in results ? results["kitchen.box"] : null;
  const value = typeof entry === "object" && entry !== null && "value" in entry ? Box.parse(entry.value) : null;
  const found = value?.ok ? value.value.recipes.find((r) => r.title === title) : undefined;
  return found?.id ?? "";
}

const favorite = async (api: Api, id: string): Promise<void> => {
  await api.app.fetch(asJson("POST", `/api/recipes/${id}/favorite`, {}));
};

describe("recipes.index", () => {
  it("lists every recipe with its minutes, price and date, and only favorites when filtered", async () => {
    const api = await simApi();
    const soup = await seed(api, "Soup", 30);
    const stew = await seed(api, "Stew", 90, 1800, "JPY");
    await favorite(api, stew);
    const all = await renderRoute("recipes.index", { routes, params: { locale: "en-US" }, ctx: api.ctx });
    expect(all.find(`recipes.link.${soup}`).text).toBe("Soup");
    expect(all.find(`recipes.minutes.${stew}`).text).toBe("1 hr, 30 min");
    expect(all.find(`recipes.price.${stew}`).text).toBe("¥1,800");
    expect(all.find(`recipes.added.${soup}`).text).toBe("November 10, 2026");
    expect(all.find("recipes.count").text).toBe("2 recipes");
    all.dispose();
    const favs = await renderRoute("recipes.index", {
      routes,
      params: { locale: "de-DE" },
      search: { only: "favorites" },
      ctx: api.ctx,
    });
    expect(favs.find(`recipes.link.${stew}`).text).toBe("Stew");
    expect(favs.find("recipes.count").text).toBe("1 Rezept");
    expect(() => favs.find(`recipes.link.${soup}`)).toThrow();
    favs.dispose();
  });
  it("shows recipes.empty when the box has none", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.index", { routes, params: { locale: "ja-JP" }, ctx: api.ctx });
    expect(r.find("recipes.empty").text).toBe("レシピはありません");
    r.dispose();
  });
  it("links each locale's index, and an en-US link has no prefix", () => {
    const rid = createCtx({ mode: "sim", seed: 5 }).random.id("Recipe");
    expect(recipes.href("recipes.index", { locale: "en-US" })).toBe("/");
    expect(recipes.href("recipes.index", { locale: "de-DE" })).toBe("/de-DE");
    expect(recipes.href("recipes.show", { locale: "en-US", recipeId: rid })).toBe(`/recipes/${rid}`);
    expect(recipes.href("recipes.show", { locale: "ja-JP", recipeId: rid })).toBe(`/ja-JP/recipes/${rid}`);
  });
});

describe("recipes.show", () => {
  it("toggles the favorite through the api and revalidates", async () => {
    const api = await simApi();
    const id = await seed(api, "Soup", 30);
    const r = await renderRoute("recipes.show", { routes, params: { locale: "en-US", recipeId: id }, ctx: api.ctx });
    expect(r.find("recipes.title").text).toBe("Soup");
    expect(r.find("recipes.addedOn").text).toBe("Added November 10, 2026");
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    await r.fire("recipes.toggleFavorite", { type: "click" });
    expect(r.find("recipes.favorite").text).toBe("Favorite");
    expect(api.sent).toContain(`POST /api/recipes/${id}/favorite`);
    await r.fire("recipes.toggleFavorite", { type: "click" });
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    r.dispose();
  });
  it("renders recipes.error for an unknown id, in the locale", async () => {
    const api = await simApi();
    const missing = api.ctx.random.id("Recipe");
    const r = await renderRoute("recipes.show", {
      routes,
      params: { locale: "de-DE", recipeId: missing },
      ctx: api.ctx,
    });
    expect(r.find("recipes.error").text).toBe("Kein solches Rezept");
    r.dispose();
  });
});

describe("recipes.new", () => {
  it("redirects a guest to recipes.index in the same locale", async () => {
    const api = await simApi();
    await api.ctx.storage.set("recipes.guest", "1");
    const r = await renderRoute("recipes.new", { routes, params: { locale: "de-DE" }, ctx: api.ctx });
    expect(r.route()).toMatchObject({ id: "recipes.index", params: { locale: "de-DE" } });
    r.dispose();
  });
  it("sends nothing on an invalid submit, focuses the first invalid field and shows its rule", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.new", { routes, params: { locale: "de-DE" }, ctx: api.ctx });
    await r.fire("recipes.save", { type: "click" });
    expect(api.sent).toEqual([]);
    expect(r.find("recipes.draft:title").state.focused).toBe(true);
    expect(r.find("recipes.draft:title:error").text).toBe("1 bis 80 Zeichen in einer Zeile");
    r.dispose();
  });
  it("creates a recipe with a price and lists it", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.new", { routes, params: { locale: "en-US" }, ctx: api.ctx });
    await r.fire("recipes.draft:title", { type: "input", value: "Pie" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "45" });
    await r.fire("recipes.draft:price.amount", { type: "input", value: "1999" });
    await r.fire("recipes.save", { type: "click" });
    expect(r.route()).toMatchObject({ id: "recipes.index", params: { locale: "en-US" } });
    const id = await seed(api, "Pie", 45);
    expect(id).not.toBe("");
    expect(r.find(`recipes.minutes.${id}`).text).toBe("45 min");
    expect(r.find(`recipes.price.${id}`).text).toBe("€19.99");
    r.dispose();
  });
  it("shows recipes.draft:title:error for a duplicate title, in the locale", async () => {
    const api = await simApi();
    await seed(api, "Soup", 30);
    const r = await renderRoute("recipes.new", { routes, params: { locale: "ja-JP" }, ctx: api.ctx });
    await r.fire("recipes.draft:title", { type: "input", value: "soup" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "10" });
    await r.fire("recipes.draft:price.amount", { type: "input", value: "500" });
    await r.fire("recipes.save", { type: "click" });
    expect(r.find("recipes.draft:title:error").text).toBe("すでに登録されています");
    r.dispose();
  });
});
