import { s } from "@keel/schema";

export const RecipeParams = s.object({ recipeId: s.id("Recipe") });

export type RecipeParams = s.infer<typeof RecipeParams>;
