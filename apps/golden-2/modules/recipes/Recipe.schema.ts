import { s } from "@keel/schema";

export const Recipe = s.object({
  id: s.id("Recipe"),
  title: s.string({ min: 1, max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
  favorite: s.boolean(),
});

export type Recipe = s.infer<typeof Recipe>;
