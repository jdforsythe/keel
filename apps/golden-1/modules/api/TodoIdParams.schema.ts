import { s } from "@keel/schema";

/** Route params of `api.editTodo` and `api.toggleTodo`. */
export const TodoIdParams = s.object({ todoId: s.id("Todo") });
export type TodoIdParams = s.infer<typeof TodoIdParams>;
