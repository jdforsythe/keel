import { s } from "@keel/schema";

export const NewRecipe = s.object({
  id: s.id("Recipe"),
  title: s.string({ min: 1, max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
});

export type NewRecipe = s.infer<typeof NewRecipe>;
