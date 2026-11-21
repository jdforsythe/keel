import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { RecipesText } from "./RecipesText.schema.ts";
import { TextData } from "./TextData.schema.ts";
import { recipes } from "./recipes.contract.ts";

/** The new-recipe page's copy in its locale. */
export const loadNew = loader(recipes, "recipes.new", { output: TextData }, async ({ params }) =>
  ok({ text: await RecipesText.load(params.locale) }),
);
