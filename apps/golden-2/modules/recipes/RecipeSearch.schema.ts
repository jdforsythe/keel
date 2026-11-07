import { s } from "@keel/schema";

export const RecipeSearch = s.object({ only: s.enum(["all", "favorites"]).optional() });

export type RecipeSearch = s.infer<typeof RecipeSearch>;
