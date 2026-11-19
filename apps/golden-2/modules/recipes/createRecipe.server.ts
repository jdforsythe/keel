import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { RecipeDraft } from "../kitchen/RecipeDraft.schema.ts";
import { KeelFields } from "./KeelFields.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { routes } from "./routes.ts";

/**
 * POST on `recipes.new`: adds through the api and goes to the index in the same locale. The api's 422 `keel.fields`
 * passes on to the Form with its `title` text replaced by the entry's `titleTaken`: the api writes no copy.
 */
export const createRecipe = action({ input: RecipeDraft, params: LocaleParams }, async (input, { params }, ctx) => {
  const r = await kitchenApi.add({ body: input }, ctx);
  if (r.ok) return ok(routes.href("recipes.index", { locale: params.locale }));
  const body = r.error.data.body;
  const fields = KeelFields.parse(body);
  if (!fields.ok || fields.value.data.title === undefined) return err(body ?? r.error);
  const text = await RecipesText.load(params.locale);
  return err({ ...fields.value, message: text.titleTaken, data: { ...fields.value.data, title: text.titleTaken } });
});
