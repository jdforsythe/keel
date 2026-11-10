import { manifest } from "@keel/router";
import type { Infer } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import BoxShell from "./BoxShell.tsx";
import { LocaleParams } from "./LocaleParams.schema.ts";
import NewRecipePage, { type Props as NewProps } from "./NewRecipePage.tsx";
import RecipeError from "./RecipeError.tsx";
import RecipeList, { type Props as IndexProps } from "./RecipeList.tsx";
import RecipePage, { type Props as ShowProps } from "./RecipePage.tsx";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { cook } from "./cook.guard.ts";
import { createRecipe } from "./createRecipe.server.ts";
import { favoriteRecipe } from "./favoriteRecipe.server.ts";
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
    title: (p: Infer<typeof IndexProps>) => p.data.text.indexTitle,
  },
  "recipes.new": {
    path: "/:locale/recipes/new",
    params: LocaleParams,
    loader: loadNew,
    component: NewRecipePage,
    layout: "recipes.shell",
    guard: cook,
    title: (p: Infer<typeof NewProps>) => p.data.text.newTitle,
  },
  "recipes.show": {
    path: "/:locale/recipes/:recipeId",
    params: RecipeParams,
    loader: loadRecipe,
    component: RecipePage,
    layout: "recipes.shell",
    errorElement: RecipeError,
    title: (p: Infer<typeof ShowProps>) =>
      formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale),
  },
});
routes.actions({ "recipes.new": { POST: createRecipe }, "recipes.show": { POST: favoriteRecipe } });
