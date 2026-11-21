import { s } from "@keel/schema";

/** Form input for a new list. */
export const ListDraft = s.object({
  name: s.string({ min: 1, max: 60 }),
});
export type ListDraft = s.infer<typeof ListDraft>;
