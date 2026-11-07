import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Box } from "../modules/recipes/Box.schema.ts";
import { routes } from "../modules/recipes/routes.ts";
import { asJson, simApi } from "./simApi.ts";

type Api = Awaited<ReturnType<typeof simApi>>;

/** Add `title` through the api and return the id it minted. */
async function seed(api: Api, title: string, minutes: number): Promise<string> {
  await api.app.fetch(asJson("POST", "/api/recipes", { title, minutes }));
  const res = await api.app.fetch(asJson("GET", "/api/recipes"));
  const body: unknown = await res.json();
  const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
  const entry =
    typeof results === "object" && results !== null && "kitchen.recipes" in results ? results["kitchen.recipes"] : null;
  const value = typeof entry === "object" && entry !== null && "value" in entry ? Box.parse(entry.value) : null;
  const found = value?.ok ? value.value.recipes.find((r) => r.title === title) : undefined;
  return found?.id ?? "";
}

const favorite = async (api: Api, id: string): Promise<void> => {
  await api.app.fetch(asJson("POST", `/api/recipes/${id}/favorite`, {}));
};

describe("recipes.index", () => {
  it("lists every recipe with its minutes, and only favorites when filtered", async () => {
    const api = await simApi();
    const soup = await seed(api, "Soup", 30);
    const stew = await seed(api, "Stew", 90);
    await favorite(api, stew);
    const all = await renderRoute("recipes.index", { routes, ctx: api.ctx });
    expect(all.find(`recipes.link.${soup}`).text).toBe("Soup");
    expect(all.find(`recipes.minutes.${stew}`).text).toBe("90 min");
    all.dispose();
    const favs = await renderRoute("recipes.index", { routes, search: { only: "favorites" }, ctx: api.ctx });
    expect(favs.find(`recipes.link.${stew}`).text).toBe("Stew");
    expect(() => favs.find(`recipes.link.${soup}`)).toThrow();
    favs.dispose();
  });
  it("shows recipes.empty when the box has none", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.index", { routes, ctx: api.ctx });
    expect(r.find("recipes.empty").text).toBe("No recipes");
    r.dispose();
  });
});

describe("recipes.show", () => {
  it("toggles the favorite through the api and revalidates", async () => {
    const api = await simApi();
    const id = await seed(api, "Soup", 30);
    const r = await renderRoute("recipes.show", { routes, params: { recipeId: id }, ctx: api.ctx });
    expect(r.find("recipes.title").text).toBe("Soup");
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    await r.fire("recipes.toggleFavorite", { type: "click" });
    expect(r.find("recipes.favorite").text).toBe("Favorite");
    expect(api.sent).toContain(`POST /api/recipes/${id}/favorite`);
    await r.fire("recipes.toggleFavorite", { type: "click" });
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    r.dispose();
  });
  it("renders recipes.error for an unknown id", async () => {
    const api = await simApi();
    const missing = api.ctx.random.id("Recipe");
    const r = await renderRoute("recipes.show", { routes, params: { recipeId: missing }, ctx: api.ctx });
    expect(r.find("recipes.error").text).toContain("No recipe");
    r.dispose();
  });
});

describe("recipes.new", () => {
  it("redirects a guest to recipes.index", async () => {
    const api = await simApi();
    await api.ctx.storage.set("recipes.guest", "1");
    const r = await renderRoute("recipes.new", { routes, ctx: api.ctx });
    expect(r.route().id).toBe("recipes.index");
    r.dispose();
  });
  it("sends nothing on an invalid submit and focuses the first invalid field", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.new", { routes, ctx: api.ctx });
    await r.fire("recipes.save", { type: "click" });
    expect(api.sent).toEqual([]);
    expect(r.find("recipes.draft:title").state.focused).toBe(true);
    r.dispose();
  });
  it("creates a recipe and lists it", async () => {
    const api = await simApi();
    const r = await renderRoute("recipes.new", { routes, ctx: api.ctx });
    await r.fire("recipes.draft:title", { type: "input", value: "Pie" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "45" });
    await r.fire("recipes.save", { type: "click" });
    expect(r.route().id).toBe("recipes.index");
    const id = await seed(api, "Pie", 45);
    expect(id).not.toBe("");
    expect(r.find(`recipes.minutes.${id}`).text).toBe("45 min");
    r.dispose();
  });
  it("shows recipes.draft:title:error for a duplicate title", async () => {
    const api = await simApi();
    await seed(api, "Soup", 30);
    const r = await renderRoute("recipes.new", { routes, ctx: api.ctx });
    await r.fire("recipes.draft:title", { type: "input", value: "soup" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "10" });
    await r.fire("recipes.save", { type: "click" });
    expect(r.find("recipes.draft:title:error").text).toBe("Already in the box");
    r.dispose();
  });
});
