import { s } from "@keel/schema";

/** Route params naming one todo in its list (`todos.edit`); loaders and actions type `params` as its Infer. */
export const TodoParams = s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") });
export type TodoParams = s.infer<typeof TodoParams>;
