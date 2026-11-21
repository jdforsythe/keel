import { s } from "@keel/schema";

/** A recipe by id, as the api's favorite endpoint takes it (no locale: the api has no copy). */
export const RecipeRef = s.object({ recipeId: s.id("Recipe") });

export type RecipeRef = s.infer<typeof RecipeRef>;
