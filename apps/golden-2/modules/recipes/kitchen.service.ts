import { endpoints } from "@keel/services";
import { ActionReply } from "./ActionReply.schema.ts";
import { BoxReply } from "./BoxReply.schema.ts";
import { ErrorReply } from "./ErrorReply.schema.ts";
import { FieldsReply } from "./FieldsReply.schema.ts";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";

export const kitchen = endpoints({
  box: { method: "GET", path: "/api/recipes", output: BoxReply },
  add: {
    method: "POST",
    path: "/api/recipes",
    body: RecipeDraft,
    output: ActionReply,
    errors: { 422: FieldsReply },
  },
  favorite: {
    method: "POST",
    path: "/api/recipes/:recipeId/favorite",
    params: RecipeParams,
    output: ActionReply,
    errors: { 404: ErrorReply },
  },
});
