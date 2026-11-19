import { s } from "@keel/schema";

/** One todo in a list. */
export const Todo = s.object({
  id: s.id("Todo"),
  listId: s.id("TodoList"),
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
  done: s.boolean(),
});
export type Todo = s.infer<typeof Todo>;
