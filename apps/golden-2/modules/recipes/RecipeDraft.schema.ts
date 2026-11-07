import { s } from "@keel/schema";

export const RecipeDraft = s.object({
  title: s.string({ min: 1, max: 80 }),
  minutes: s.int({ min: 1, max: 600 }),
});

export type RecipeDraft = s.infer<typeof RecipeDraft>;
