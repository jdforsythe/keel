import { s } from "@keel/schema";

/** A removal still running (`BoardView.removals`): its instance id, its list and its state in `removalChart`. */
export const Removal = s.object({
  flow: s.string({ min: 1 }),
  list: s.id("TodoList"),
  state: s.enum(["hidden", "purging", "restoring"]),
});
export type Removal = s.infer<typeof Removal>;
