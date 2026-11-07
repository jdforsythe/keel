import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { kitchenApi } from "./kitchenApi.ts";
import { routes } from "./routes.ts";

/** POST on `recipes.new`: adds through the api; its 422 `keel.fields` is passed on to the Form; success goes to the index. */
export const createRecipe = action({ input: RecipeDraft }, async (input, { url }, ctx) => {
  const r = await kitchenApi(new URL(url).origin).add({ body: input }, ctx);
  if (!r.ok) return err(r.error.data.body?.error ?? r.error);
  return ok(routes.href("recipes.index"));
});
