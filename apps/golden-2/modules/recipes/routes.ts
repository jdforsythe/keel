import { manifest } from "@keel/router";
import { formatMessage } from "@keel/std-messages";
import { CatalogSearch } from "../kitchen/CatalogSearch.schema.ts";
import BoxShell from "./BoxShell.tsx";
import CatalogPage from "./CatalogPage.tsx";
import { LocaleParams } from "./LocaleParams.schema.ts";
import NewRecipePage from "./NewRecipePage.tsx";
import RecipeError from "./RecipeError.tsx";
import RecipeList from "./RecipeList.tsx";
import RecipePage from "./RecipePage.tsx";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { cook } from "./cook.guard.ts";
import { createRecipe } from "./createRecipe.server.ts";
import { favoriteRecipe } from "./favoriteRecipe.server.ts";
import { loadCatalog } from "./loadCatalog.server.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadNew } from "./loadNew.server.ts";
import { loadRecipe } from "./loadRecipe.server.ts";
import { loadShell } from "./loadShell.server.ts";

export const routes = manifest({
  "recipes.shell": { component: BoxShell, loader: loadShell },
  "recipes.index": {
    path: "/:locale",
    params: LocaleParams,
    search: RecipeSearch,
    loader: loadIndex,
    component: RecipeList,
    layout: "recipes.shell",
    title: (p) => p.data.text.indexTitle,
  },
  "recipes.catalog": {
    path: "/:locale/catalog",
    params: LocaleParams,
    search: CatalogSearch,
    loader: loadCatalog,
    component: CatalogPage,
    layout: "recipes.shell",
    title: (p) => p.data.text.catalogTitle,
  },
  "recipes.new": {
    path: "/:locale/recipes/new",
    params: LocaleParams,
    loader: loadNew,
    component: NewRecipePage,
    layout: "recipes.shell",
    guard: cook,
    title: (p) => p.data.text.newTitle,
  },
  "recipes.show": {
    path: "/:locale/recipes/:recipeId",
    params: RecipeParams,
    loader: loadRecipe,
    component: RecipePage,
    layout: "recipes.shell",
    errorElement: RecipeError,
    title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale),
  },
});
routes.actions({ "recipes.new": { POST: createRecipe }, "recipes.show": { POST: favoriteRecipe } });
