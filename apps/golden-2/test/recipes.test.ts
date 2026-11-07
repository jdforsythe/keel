import { properties, render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { ActionReply } from "../modules/recipes/ActionReply.schema.ts";
import BoxShell from "../modules/recipes/BoxShell.tsx";
import { ErrorReply } from "../modules/recipes/ErrorReply.schema.ts";
import { FieldsReply } from "../modules/recipes/FieldsReply.schema.ts";
import { KeelFields } from "../modules/recipes/KeelFields.schema.ts";
import NewRecipePage from "../modules/recipes/NewRecipePage.tsx";
import { Nothing } from "../modules/recipes/Nothing.schema.ts";
import { Recipe } from "../modules/recipes/Recipe.schema.ts";
import { RecipeDraft } from "../modules/recipes/RecipeDraft.schema.ts";
import RecipeError from "../modules/recipes/RecipeError.tsx";
import RecipeList from "../modules/recipes/RecipeList.tsx";
import RecipePage from "../modules/recipes/RecipePage.tsx";
import { RecipeParams } from "../modules/recipes/RecipeParams.schema.ts";
import { RecipeSearch } from "../modules/recipes/RecipeSearch.schema.ts";
import { cook } from "../modules/recipes/cook.guard.ts";
import { createRecipe } from "../modules/recipes/createRecipe.server.ts";
import { favoriteRecipe } from "../modules/recipes/favoriteRecipe.server.ts";
import { kitchen } from "../modules/recipes/kitchen.service.ts";
import { kitchenApi } from "../modules/recipes/kitchenApi.ts";
import { loadIndex } from "../modules/recipes/loadIndex.server.ts";
import { loadRecipe } from "../modules/recipes/loadRecipe.server.ts";
import "../modules/recipes/routes.ts";
import { asJson, simApi } from "./simApi.ts";

const soup = { id: "r1", title: "Soup", minutes: 30, favorite: false };
const stew = { id: "r2", title: "Stew", minutes: 90, favorite: true };

/** A request context as the router passes it: `params` parsed by `RecipeParams`, the test page's url. */
const reqOf = (params: unknown) => {
  const r = RecipeParams.parse(params);
  if (!r.ok) throw new Error(r.error.message);
  return { params: r.value, url: location.href, caller: "c1", stores: undefined };
};
const bare = { params: {}, url: location.href, caller: "c1", stores: undefined };

/** The first recipe the api lists, after adding `title` through it. */
async function addAndFind(api: Awaited<ReturnType<typeof simApi>>, title: string): Promise<string> {
  await api.app.fetch(asJson("POST", "/api/recipes", { title, minutes: 20 }));
  const body: unknown = await (await api.app.fetch(asJson("GET", "/api/recipes"))).json();
  const found = typeof body === "object" && body !== null && "results" in body ? JSON.stringify(body.results) : "";
  return /"id":"([^"]+)"/.exec(found)?.[1] ?? "";
}

describe("BoxShell", () => {
  it("links to the recipes and to a new recipe", () => {
    const t = render(BoxShell, { props: {} });
    expect(t.find("recipes.home").name).toBe("Recipes");
    expect(t.find("recipes.newLink").name).toBe("New recipe");
    t.dispose();
  });
});

describe("RecipeList", () => {
  it("lists each recipe with its minutes", () => {
    const t = render(RecipeList, { props: { search: {}, data: { recipes: [soup, stew] } } });
    expect(t.find("recipes.link.r1").text).toBe("Soup");
    expect(t.find("recipes.minutes.r2").text).toBe("90 min");
    t.dispose();
  });
  it("says there are no recipes for an empty box", () => {
    const t = render(RecipeList, { props: { search: {}, data: { recipes: [] } } });
    expect(t.find("recipes.empty").text).toBe("No recipes");
    t.dispose();
  });
  it("holds its properties over generated recipes", async () => {
    await properties(RecipeList, { runs: 100, seed: 1337 });
  });
});

describe("RecipePage", () => {
  it("shows the recipe, its favorite state and the toggle button", () => {
    const t = render(RecipePage, { props: { params: { recipeId: "r1" }, data: soup } });
    expect(t.find("recipes.title").text).toBe("Soup");
    expect(t.find("recipes.favorite").text).toBe("Not favorite");
    expect(t.find("recipes.toggleFavorite").name).toBe("Toggle favorite");
    t.dispose();
  });
  it("shows Favorite for a favorite recipe", () => {
    const t = render(RecipePage, { props: { params: { recipeId: "r2" }, data: stew } });
    expect(t.find("recipes.favorite").text).toBe("Favorite");
    t.dispose();
  });
});

describe("NewRecipePage", () => {
  it("shows the heading, labelled fields and Save", () => {
    const t = render(NewRecipePage, { props: {} });
    expect(t.find("recipes.new.heading").text).toBe("New recipe");
    expect(t.find("recipes.draft:title").name).toBe("Title");
    expect(t.find("recipes.draft:minutes").name).toBe("Minutes");
    expect(t.find("recipes.save").name).toBe("Save");
    t.dispose();
  });
});

describe("RecipeError", () => {
  it("names the code and the message", () => {
    const t = render(RecipeError, { props: { error: { code: "keel.notFound", message: "No recipe x" } } });
    expect(t.find("recipes.error.heading").text).toBe("Something went wrong");
    expect(t.find("recipes.error").text).toBe("No recipe x");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(RecipeError, { runs: 100, seed: 1337 });
  });
});

describe("recipe schemas", () => {
  it("Recipe and RecipeDraft bound title and minutes", () => {
    expect(Recipe.parse(soup).ok).toBe(true);
    expect(Recipe.parse({ ...soup, minutes: 0 }).ok).toBe(false);
    expect(RecipeDraft.parse({ title: "Pie", minutes: 45 }).ok).toBe(true);
    expect(RecipeDraft.parse({ title: "", minutes: 45 }).ok).toBe(false);
  });
  it("RecipeParams needs a recipeId and RecipeSearch takes all or favorites", () => {
    expect(RecipeParams.parse({ recipeId: "r1" }).ok).toBe(true);
    expect(RecipeParams.parse({}).ok).toBe(false);
    expect(RecipeSearch.parse({}).ok).toBe(true);
    expect(RecipeSearch.parse({ only: "favorites" }).ok).toBe(true);
    expect(RecipeSearch.parse({ only: "nope" }).ok).toBe(false);
  });
  it("Nothing takes no fields", () => {
    expect(Nothing.parse({}).ok).toBe(true);
  });
  it("ActionReply, ErrorReply, KeelFields and FieldsReply parse the api's replies", () => {
    expect(ActionReply.parse({ ok: true, value: null }).ok).toBe(true);
    expect(ActionReply.parse({ ok: false, value: null }).ok).toBe(false);
    expect(ErrorReply.parse({ ok: false, error: { code: "keel.notFound", message: "x", data: null } }).ok).toBe(true);
    const fields = { code: "keel.fields", message: "invalid", data: { title: "Already in the box" } };
    expect(KeelFields.parse(fields).ok).toBe(true);
    expect(FieldsReply.parse({ ok: false, error: fields }).ok).toBe(true);
    expect(FieldsReply.parse({ ok: false, error: { ...fields, code: "other" } }).ok).toBe(false);
  });
});

describe("kitchen service", () => {
  it("names the three endpoints and kitchenApi builds a client for them", async () => {
    expect(Object.keys(kitchen).sort()).toEqual(["add", "box", "favorite"]);
    const api = await simApi();
    const r = await kitchenApi(location.origin).box({}, api.ctx);
    expect(r.ok && r.value.results["kitchen.recipes"].value.recipes).toEqual([]);
    expect(api.sent).toEqual(["GET /api/recipes"]);
  });
});

describe("client loaders, actions and guard (through the api deployable)", () => {
  it("loadIndex lists the box, or only favorites", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    await api.app.fetch(asJson("POST", `/api/recipes/${id}/favorite`, {}));
    await addAndFind(api, "Stew");
    const all = await loadIndex.run({ ...bare, search: {} }, api.ctx);
    expect(all.ok && all.value.recipes.map((x) => x.title)).toEqual(["Soup", "Stew"]);
    const favs = await loadIndex.run({ ...bare, search: { only: "favorites" } }, api.ctx);
    expect(favs.ok && favs.value.recipes.map((x) => x.title)).toEqual(["Soup"]);
  });
  it("loadRecipe finds by id or answers keel.notFound", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    const found = await loadRecipe.run({ ...reqOf({ recipeId: id }), search: {} }, api.ctx);
    expect(found.ok && found.value.title).toBe("Soup");
    const missing = await loadRecipe.run({ ...reqOf({ recipeId: "nope" }), search: {} }, api.ctx);
    expect(missing.ok ? null : missing.error.code).toBe("keel.notFound");
  });
  it("createRecipe adds through the api and passes on its keel.fields for a duplicate", async () => {
    const api = await simApi();
    const made = await createRecipe.run({ title: "Pie", minutes: 45 }, bare, api.ctx);
    expect(made).toEqual({ ok: true, value: "/" });
    const dup = await createRecipe.run({ title: "pie", minutes: 10 }, bare, api.ctx);
    expect(dup.ok ? null : dup.error).toMatchObject({ code: "keel.fields", data: { title: "Already in the box" } });
  });
  it("favoriteRecipe toggles through the api and answers the 404 for an unknown id", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    expect(await favoriteRecipe.run({}, reqOf({ recipeId: id }), api.ctx)).toEqual({ ok: true, value: null });
    const missing = await favoriteRecipe.run({}, reqOf({ recipeId: "nope" }), api.ctx);
    expect(missing.ok).toBe(false);
  });
  it("cook denies while ctx.storage recipes.guest is 1", async () => {
    const api = await simApi();
    expect((await cook.run({ url: "/" }, api.ctx)).ok).toBe(true);
    await api.ctx.storage.set("recipes.guest", "1");
    const denied = await cook.run({ url: "/" }, api.ctx);
    expect(denied.ok ? null : denied.error.code).toBe("keel.denied");
  });
});
