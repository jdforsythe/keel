import { s } from "@keel/schema";

/** A named list of todos; `hidden` while its removal waits (`api.hideList`, `removal`). */
export const TodoList = s.object({
  id: s.id("TodoList"),
  name: s.string({ min: 1, max: 60 }),
  hidden: s.boolean().optional(),
});
export type TodoList = s.infer<typeof TodoList>;
