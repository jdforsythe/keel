import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { RecipeDraft } from "../kitchen/RecipeDraft.schema.ts";
import { KeelFields } from "./KeelFields.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { recipes } from "./recipes.contract.ts";

/**
 * POST on `recipes.new`: adds through the api and goes to the index in the same locale. The api's 422 `keel.fields`
 * passes on to the Form with its `title` text replaced by the entry's `titleTaken`: the api writes no copy.
 */
export const createRecipe = action(recipes, "recipes.new", { input: RecipeDraft }, async (input, { params }, ctx) => {
  const r = await kitchenApi.add({ body: input }, ctx);
  if (r.ok) return ok(recipes.href("recipes.index", { locale: params.locale }));
  const body = r.error.data.body;
  const fields = KeelFields.parse(body);
  if (!fields.ok || fields.value.data.title === undefined) return err(body ?? r.error);
  const text = await RecipesText.load(params.locale);
  return err(keelError.fields.make({ ...fields.value.data, title: text.titleTaken }));
});
