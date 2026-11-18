import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/lists/:listId/todos` and `POST /api/todos/:todoId`: the todo's fields and the write's `key`, `base` and `owner`. */
export const TodoWrite = s.object({
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
  write: Write,
});
export type TodoWrite = s.infer<typeof TodoWrite>;
