import { properties, render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Nothing } from "../modules/kitchen/Nothing.schema.ts";
import { Recipe } from "../modules/kitchen/Recipe.schema.ts";
import { RecipeDraft } from "../modules/kitchen/RecipeDraft.schema.ts";
import { RecipeRef } from "../modules/kitchen/RecipeRef.schema.ts";
import { AppLocale } from "../modules/recipes/AppLocale.schema.ts";
import BoxShell from "../modules/recipes/BoxShell.tsx";
import { ErrorReply } from "../modules/recipes/ErrorReply.schema.ts";
import { IndexData } from "../modules/recipes/IndexData.schema.ts";
import { KeelFields } from "../modules/recipes/KeelFields.schema.ts";
import { LocaleParams } from "../modules/recipes/LocaleParams.schema.ts";
import NewRecipePage from "../modules/recipes/NewRecipePage.tsx";
import { RecipeData } from "../modules/recipes/RecipeData.schema.ts";
import RecipeError from "../modules/recipes/RecipeError.tsx";
import RecipeList from "../modules/recipes/RecipeList.tsx";
import RecipePage from "../modules/recipes/RecipePage.tsx";
import { RecipeParams } from "../modules/recipes/RecipeParams.schema.ts";
import { RecipeSearch } from "../modules/recipes/RecipeSearch.schema.ts";
import { RecipesText } from "../modules/recipes/RecipesText.schema.ts";
import deDE from "../modules/recipes/RecipesText/de-DE.ts";
import enUS from "../modules/recipes/RecipesText/en-US.ts";
import jaJP from "../modules/recipes/RecipesText/ja-JP.ts";
import { TextData } from "../modules/recipes/TextData.schema.ts";
import { cook } from "../modules/recipes/cook.guard.ts";
import { createRecipe } from "../modules/recipes/createRecipe.server.ts";
import { favoriteRecipe } from "../modules/recipes/favoriteRecipe.server.ts";
import { fieldText } from "../modules/recipes/fieldText.ts";
import { kitchen } from "../modules/recipes/kitchen.service.ts";
import { kitchenApi } from "../modules/recipes/kitchenApi.ts";
import { loadIndex } from "../modules/recipes/loadIndex.server.ts";
import { loadNew } from "../modules/recipes/loadNew.server.ts";
import { loadRecipe } from "../modules/recipes/loadRecipe.server.ts";
import { loadShell } from "../modules/recipes/loadShell.server.ts";
import "../modules/recipes/routes.ts";
import { asJson, draft, simApi } from "./simApi.ts";

const NBSP = " ";
const en = await RecipesText.load("en-US");
const de = await RecipesText.load("de-DE");
const ja = await RecipesText.load("ja-JP");

/** A value parsed by `schema`, so format types (titles, dates) carry their brand. */
function parsed<T>(
  schema: { parse(v: unknown): { ok: true; value: T } | { ok: false; error: { message: string } } },
  v: unknown,
): T {
  const r = schema.parse(v);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const pasta = parsed(Recipe, {
  id: "r1",
  title: "Pasta bake",
  minutes: 30,
  favorite: false,
  price: { amount: 1250, currency: "EUR" },
  addedOn: "2026-11-10",
});
const soup = parsed(Recipe, {
  id: "r2",
  title: "Miso soup",
  minutes: 90,
  favorite: true,
  price: { amount: 1800, currency: "JPY" },
  addedOn: "2026-11-10",
});

/** A request context as the router passes it: `params` parsed by `schema`, the test page's url. */
const reqOf = <P>(
  schema: { parse(v: unknown): { ok: true; value: P } | { ok: false; error: { message: string } } },
  params: unknown,
) => ({
  params: parsed(schema, params),
  url: location.href,
  caller: "c1",
  stores: undefined,
});

/** The id of `title` after adding it through the api. */
async function addAndFind(api: Awaited<ReturnType<typeof simApi>>, title: string): Promise<string> {
  await api.app.fetch(asJson("POST", "/api/recipes", draft(title, 20)));
  const body: unknown = await (await api.app.fetch(asJson("GET", "/api/recipes"))).json();
  const found = typeof body === "object" && body !== null && "results" in body ? JSON.stringify(body.results) : "";
  return /"id":"([^"]+)"/.exec(found)?.[1] ?? "";
}

describe("RecipesText", () => {
  it("loads each locale's file, the files' default exports", async () => {
    expect(await RecipesText.load("en-US")).toEqual(enUS);
    expect(await RecipesText.load("de-DE")).toEqual(deDE);
    expect(await RecipesText.load("ja-JP")).toEqual(jaJP);
    expect(RecipesText.parse(de).ok).toBe(true);
  });
});

describe("BoxShell", () => {
  it("marks its region with the locale and links to the recipes, a new recipe and each locale", () => {
    const t = render(BoxShell, { props: { params: { locale: "de-DE" }, data: { text: de } } });
    expect(t.find("recipes.home").name).toBe("Rezepte");
    expect(t.find("recipes.newLink").name).toBe("Neues Rezept");
    expect(t.find("recipes.locale.en-US").name).toBe("English (United States)");
    expect(t.find("recipes.locale.de-DE").name).toBe("Deutsch (Deutschland)");
    expect(t.find("recipes.locale.ja-JP").name).toBe("日本語 (日本)");
    t.dispose();
  });
  it("holds its properties over generated locales and copy", async () => {
    await properties(BoxShell, { runs: 100, seed: 1337 });
  });
});

describe("RecipeList", () => {
  it("shows count, price, time and date for en-US", () => {
    const t = render(RecipeList, {
      props: { params: { locale: "en-US" }, search: {}, data: { recipes: [pasta, soup], text: en } },
    });
    expect(t.find("recipes.list.title").text).toBe("Recipes");
    expect(t.find("recipes.count").text).toBe("2 recipes");
    expect(t.find("recipes.link.r1").text).toBe("Pasta bake");
    expect(t.find("recipes.price.r1").text).toBe("€12.50");
    expect(t.find("recipes.price.r2").text).toBe("¥1,800");
    expect(t.find("recipes.minutes.r1").text).toBe("30 min");
    expect(t.find("recipes.minutes.r2").text).toBe("1 hr, 30 min");
    expect(t.find("recipes.added.r1").text).toBe("November 10, 2026");
    t.dispose();
  });
  it("shows them for de-DE and ja-JP", () => {
    const d = render(RecipeList, {
      props: { params: { locale: "de-DE" }, search: {}, data: { recipes: [pasta, soup], text: de } },
    });
    expect(d.find("recipes.count").text).toBe("2 Rezepte");
    expect(d.find("recipes.price.r1").text).toBe(`12,50${NBSP}€`);
    expect(d.find("recipes.price.r2").text).toBe(`1.800${NBSP}¥`);
    expect(d.find("recipes.minutes.r2").text).toBe("1 Std., 30 Min.");
    expect(d.find("recipes.added.r2").text).toBe("10. November 2026");
    expect(d.find("recipes.filter.favorites").name).toBe("Favoriten");
    d.dispose();
    const j = render(RecipeList, {
      props: { params: { locale: "ja-JP" }, search: {}, data: { recipes: [soup], text: ja } },
    });
    expect(j.find("recipes.count").text).toBe("1 件のレシピ");
    expect(j.find("recipes.price.r2").text).toBe("￥1,800");
    expect(j.find("recipes.minutes.r2").text).toBe("1 時間 30 分");
    expect(j.find("recipes.added.r2").text).toBe("2026年11月10日");
    j.dispose();
  });
  it("says there are no recipes for an empty box", () => {
    const t = render(RecipeList, {
      props: { params: { locale: "en-US" }, search: {}, data: { recipes: [], text: en } },
    });
    expect(t.find("recipes.empty").text).toBe("No recipes");
    expect(t.find("recipes.count").text).toBe("0 recipes");
    t.dispose();
  });
  it("holds its properties over generated recipes", async () => {
    await properties(RecipeList, { runs: 100, seed: 1337 });
  });
});

describe("RecipePage", () => {
  it("shows the recipe, its price, date, favorite state and the toggle in its locale", () => {
    const t = render(RecipePage, {
      props: { params: { locale: "de-DE", recipeId: "r1" }, data: { recipe: pasta, text: de } },
    });
    expect(t.find("recipes.title").text).toBe("Pasta bake");
    expect(t.find("recipes.price").text).toBe(`12,50${NBSP}€`);
    expect(t.find("recipes.minutes").text).toBe("30 Min.");
    expect(t.find("recipes.addedOn").text).toBe("Hinzugefügt am 10. November 2026");
    expect(t.find("recipes.favorite").text).toBe("Kein Favorit");
    expect(t.find("recipes.toggleFavorite").name).toBe("Favorit umschalten");
    t.dispose();
  });
  it("shows Favorite for a favorite recipe", () => {
    const t = render(RecipePage, {
      props: { params: { locale: "ja-JP", recipeId: "r2" }, data: { recipe: soup, text: ja } },
    });
    expect(t.find("recipes.favorite").text).toBe("お気に入り");
    expect(t.find("recipes.addedOn").text).toBe("2026年11月10日に追加");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(RecipePage, { runs: 100, seed: 1337 });
  });
});

describe("NewRecipePage", () => {
  it("shows the heading, labelled fields and Save in its locale", () => {
    const t = render(NewRecipePage, { props: { params: { locale: "de-DE" }, data: { text: de } } });
    expect(t.find("recipes.new.heading").text).toBe("Neues Rezept");
    expect(t.find("recipes.draft:title").name).toBe("Titel");
    expect(t.find("recipes.draft:minutes").name).toBe("Minuten");
    expect(t.find("recipes.draft:price.amount").name).toBe("Preis in Cent, Pence oder Yen");
    expect(t.find("recipes.draft:price.currency").name).toBe("Währung");
    expect(t.find("recipes.save").name).toBe("Speichern");
    t.dispose();
  });
});

describe("fieldText", () => {
  it("gives each field's rule from the entry, and otherRule for any other path", () => {
    const text = fieldText(en);
    expect(text({ rule: "format", path: "title", format: "line(1..80)" })).toBe("1 to 80 characters on one line");
    expect(text({ rule: "min", path: "minutes", min: 1 })).toBe("A whole number of minutes from 1 to 600");
    expect(text({ rule: "type", path: "price.amount" })).toBe("A whole number");
    expect(text({ rule: "enum", path: "price.currency", values: ["EUR"] })).toBe("Pick a currency");
    expect(text({ rule: "required", path: "other" })).toBe("Check this value");
  });
});

describe("RecipeError", () => {
  it("heads with the message and names the code", () => {
    const t = render(RecipeError, { props: { error: { code: "keel.notFound", message: "Kein Rezept x" } } });
    expect(t.find("recipes.error").text).toBe("Kein Rezept x");
    expect(t.find("recipes.error.code").text).toBe("keel.notFound");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(RecipeError, { runs: 100, seed: 1337 });
  });
});

describe("recipe schemas", () => {
  it("Recipe and RecipeDraft bound title, minutes and price", () => {
    expect(Recipe.parse(pasta).ok).toBe(true);
    expect(Recipe.parse({ ...pasta, minutes: 0 }).ok).toBe(false);
    expect(Recipe.parse({ ...pasta, addedOn: "2026-02-30" }).ok).toBe(false);
    expect(RecipeDraft.parse(draft("Pie", 45)).ok).toBe(true);
    expect(RecipeDraft.parse(draft("", 45)).ok).toBe(false);
    expect(RecipeDraft.parse(draft("a‮b", 45)).ok).toBe(false);
    expect(RecipeDraft.parse(draft("👨‍👩‍👧".repeat(80), 45)).ok).toBe(true);
    expect(RecipeDraft.parse(draft("Pie", 45, 1, "XYZ")).ok).toBe(false);
  });
  it("AppLocale serves three locales; params need one", () => {
    expect(AppLocale.parse("ja-JP").ok).toBe(true);
    expect(AppLocale.parse("fr-FR").ok).toBe(false);
    expect(LocaleParams.parse({ locale: "de-DE" }).ok).toBe(true);
    expect(LocaleParams.parse({}).ok).toBe(false);
    expect(RecipeParams.parse({ locale: "en-US", recipeId: "r1" }).ok).toBe(true);
    expect(RecipeParams.parse({ recipeId: "r1" }).ok).toBe(false);
    expect(RecipeRef.parse({ recipeId: "r1" }).ok).toBe(true);
    expect(RecipeRef.parse({}).ok).toBe(false);
  });
  it("RecipeSearch takes all or favorites", () => {
    expect(RecipeSearch.parse({}).ok).toBe(true);
    expect(RecipeSearch.parse({ only: "favorites" }).ok).toBe(true);
    expect(RecipeSearch.parse({ only: "nope" }).ok).toBe(false);
  });
  it("TextData, IndexData and RecipeData carry the entry", () => {
    expect(TextData.parse({ text: en }).ok).toBe(true);
    expect(IndexData.parse({ recipes: [pasta], text: ja }).ok).toBe(true);
    expect(RecipeData.parse({ recipe: soup, text: de }).ok).toBe(true);
    expect(TextData.parse({ text: { ...en, home: "a{b" } }).ok).toBe(false);
  });
  it("Nothing takes no fields", () => {
    expect(Nothing.parse({}).ok).toBe(true);
  });
  it("ErrorReply is the api's KeelError answer; KeelFields narrows a keel.fields one", () => {
    expect(ErrorReply.parse({ code: "keel.notFound", message: "x", data: null }).ok).toBe(true);
    expect(ErrorReply.parse({ ok: false, error: { code: "keel.notFound", message: "x", data: null } }).ok).toBe(false);
    const fields = { code: "keel.fields", message: "invalid", data: { title: "Already in the box" } };
    expect(KeelFields.parse(fields).ok).toBe(true);
    expect(KeelFields.parse({ ...fields, code: "other" }).ok).toBe(false);
  });
});

describe("kitchen service", () => {
  it("names the three endpoints and kitchenApi calls the kitchen module for the route's value", async () => {
    expect(Object.keys(kitchen).sort()).toEqual(["add", "box", "favorite"]);
    const api = await simApi();
    const r = await kitchenApi.box({}, api.ctx);
    expect(r.ok && r.value.recipes).toEqual([]);
    expect(api.sent).toEqual(["GET /api/recipes"]);
  });
});

describe("client loaders, actions and guard (through the api deployable)", () => {
  it("loadShell and loadNew load the locale's copy", async () => {
    const api = await simApi();
    const shell = await loadShell.run({ ...reqOf(LocaleParams, { locale: "ja-JP" }), search: {} }, api.ctx);
    expect(shell.ok && shell.value.text.home).toBe("レシピ");
    const made = await loadNew.run({ ...reqOf(LocaleParams, { locale: "de-DE" }), search: {} }, api.ctx);
    expect(made.ok && made.value.text.newHeading).toBe("Neues Rezept");
  });
  it("loadIndex lists the box, or only favorites, with the copy", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    await api.app.fetch(asJson("POST", `/api/recipes/${id}/favorite`, {}));
    await addAndFind(api, "Stew");
    const req = reqOf(LocaleParams, { locale: "en-US" });
    const all = await loadIndex.run({ ...req, search: {} }, api.ctx);
    expect(all.ok && all.value.recipes.map((x) => x.title)).toEqual(["Soup", "Stew"]);
    expect(all.ok && all.value.recipes[0]?.addedOn).toBe("2026-11-10");
    expect(all.ok && all.value.text.listTitle).toBe("Recipes");
    const favs = await loadIndex.run({ ...req, search: { only: "favorites" } }, api.ctx);
    expect(favs.ok && favs.value.recipes.map((x) => x.title)).toEqual(["Soup"]);
  });
  it("loadRecipe finds by id or answers keel.notFound in the locale", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    const found = await loadRecipe.run(
      { ...reqOf(RecipeParams, { locale: "en-US", recipeId: id }), search: {} },
      api.ctx,
    );
    expect(found.ok && found.value.recipe.title).toBe("Soup");
    const missing = await loadRecipe.run(
      { ...reqOf(RecipeParams, { locale: "de-DE", recipeId: "nope" }), search: {} },
      api.ctx,
    );
    expect(missing.ok ? null : missing.error).toMatchObject({ code: "keel.notFound", message: "Kein Rezept nope" });
  });
  it("createRecipe adds through the api and gives a duplicate the locale's titleTaken", async () => {
    const api = await simApi();
    const made = await createRecipe.run(
      parsed(RecipeDraft, draft("Pie", 45)),
      reqOf(LocaleParams, { locale: "en-US" }),
      api.ctx,
    );
    expect(made).toEqual({ ok: true, value: "/" });
    const dup = await createRecipe.run(
      parsed(RecipeDraft, draft("pie", 10)),
      reqOf(LocaleParams, { locale: "de-DE" }),
      api.ctx,
    );
    expect(dup.ok ? null : dup.error).toMatchObject({ code: "keel.fields", data: { title: "Schon in der Sammlung" } });
  });
  it("favoriteRecipe toggles through the api and answers the 404 for an unknown id", async () => {
    const api = await simApi();
    const id = await addAndFind(api, "Soup");
    expect(await favoriteRecipe.run({}, reqOf(RecipeParams, { locale: "en-US", recipeId: id }), api.ctx)).toEqual({
      ok: true,
      value: null,
    });
    const missing = await favoriteRecipe.run({}, reqOf(RecipeParams, { locale: "en-US", recipeId: "nope" }), api.ctx);
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
