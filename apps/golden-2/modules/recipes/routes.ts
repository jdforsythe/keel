import { manifest } from "@keel/router";
import { formatMessage } from "@keel/std-messages";
import BoxShell from "./BoxShell.tsx";
import CatalogPage from "./CatalogPage.tsx";
import NewRecipePage from "./NewRecipePage.tsx";
import RecipeError from "./RecipeError.tsx";
import RecipeList from "./RecipeList.tsx";
import RecipePage from "./RecipePage.tsx";
import { cook } from "./cook.guard.ts";
import { createRecipe } from "./createRecipe.server.ts";
import { favoriteRecipe } from "./favoriteRecipe.server.ts";
import { loadCatalog } from "./loadCatalog.server.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadNew } from "./loadNew.server.ts";
import { loadRecipe } from "./loadRecipe.server.ts";
import { loadShell } from "./loadShell.server.ts";
import { recipes } from "./recipes.contract.ts";

export const routes = manifest(recipes, {
  "recipes.shell": { component: BoxShell, loader: loadShell },
  "recipes.index": {
    loader: loadIndex,
    component: RecipeList,
    layout: "recipes.shell",
    title: (p) => p.data.text.indexTitle,
  },
  "recipes.catalog": {
    loader: loadCatalog,
    component: CatalogPage,
    layout: "recipes.shell",
    title: (p) => p.data.text.catalogTitle,
  },
  "recipes.new": {
    loader: loadNew,
    component: NewRecipePage,
    layout: "recipes.shell",
    guard: cook,
    title: (p) => p.data.text.newTitle,
    POST: createRecipe,
  },
  "recipes.show": {
    loader: loadRecipe,
    component: RecipePage,
    layout: "recipes.shell",
    errorElement: RecipeError,
    title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale),
    POST: favoriteRecipe,
  },
});
