import { s } from "@keel/schema";
import { AppLocale } from "./AppLocale.schema.ts";

export const RecipeParams = s.object({ locale: AppLocale, recipeId: s.id("Recipe") });

export type RecipeParams = s.infer<typeof RecipeParams>;
