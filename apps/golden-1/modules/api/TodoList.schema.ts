import { s } from "@keel/schema";

/** A named list of todos. */
export const TodoList = s.object({
  id: s.id("TodoList"),
  name: s.string({ min: 1, max: 60 }),
});
export type TodoList = s.infer<typeof TodoList>;
