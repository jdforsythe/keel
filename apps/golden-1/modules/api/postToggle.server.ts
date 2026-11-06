import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { board } from "./board.ts";
import { toggleTodo } from "./toggleTodo.ts";

type Params = { readonly todoId: string };

/** `POST /api/todos/:todoId/toggle`: flip `done`; an unknown todo is `keel.notFound`. */
export const postToggle = action(s.object({}), (_input, at: { readonly params: Params }) => {
  const { todoId } = at.params;
  const todo = board.get("todos").find((t) => t.id === todoId);
  if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
  const r = tx(toggleTodo, { id: todo.id });
  return r.ok ? ok(null) : err(r.error);
});
