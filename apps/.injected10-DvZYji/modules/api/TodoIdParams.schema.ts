import { s } from "@keel/schema";

/** Route params of `api.todo` and `api.todoToggle`; their actions type `params` as its Infer. */
export const TodoIdParams = s.object({ todoId: s.id("Todo") });
export type TodoIdParams = s.infer<typeof TodoIdParams>;
