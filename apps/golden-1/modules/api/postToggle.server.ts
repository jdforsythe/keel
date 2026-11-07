import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/todos/:todoId/toggle`: flip `done`; an unknown todo is `keel.notFound`. */
export const postToggle = action(
  { input: s.object({}), params: TodoIdParams, stores: boardStores },
  (_input, { params, caller, stores }) => {
    const { todoId } = params;
    const todo = stores.board.get("todos").find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    const r = tx(stores.toggleTodo, { id: todoId }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
