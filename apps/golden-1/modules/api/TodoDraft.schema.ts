import { s } from "@keel/schema";

/** Form input for a new or edited todo. */
export const TodoDraft = s.object({
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
});
export type TodoDraft = s.infer<typeof TodoDraft>;
