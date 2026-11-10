import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { routes } from "./routes.ts";

/**
 * POST on `recipes.new`: adds through the api and goes to the index in the same locale. The api's 422 `keel.fields`
 * passes on to the Form with its `title` text replaced by the entry's `titleTaken`: the api writes no copy.
 */
export const createRecipe = action(
  { input: RecipeDraft, params: LocaleParams },
  async (input, { params, url }, ctx) => {
    const r = await kitchenApi(new URL(url).origin).add({ body: input }, ctx);
    if (r.ok) return ok(routes.href("recipes.index", { locale: params.locale }));
    const fields = r.error.data.body?.error;
    if (fields === undefined || fields.data.title === undefined) return err(fields ?? r.error);
    const text = await RecipesText.load(params.locale);
    return err({ ...fields, message: text.titleTaken, data: { ...fields.data, title: text.titleTaken } });
  },
);
