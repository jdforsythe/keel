import { s } from "@keel/schema";

/** Route params naming one list (`todos.list`, `api.addTodo`, `api.removeList`). */
export const ListParams = s.object({ listId: s.id("TodoList") });
export type ListParams = s.infer<typeof ListParams>;
