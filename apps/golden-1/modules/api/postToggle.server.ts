import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Nothing } from "./Nothing.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { ToggleWrite } from "./ToggleWrite.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/todos/:todoId/toggle`: flip `done`, with the write's key and base; an unknown todo is `keel.notFound`. */
export const postToggle = action(
  { input: ToggleWrite, params: TodoIdParams, output: Nothing, stores: boardStores },
  (input, { params, caller, stores }) => {
    const { todoId } = params;
    const todo = stores.board.get("todos").find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    const r = tx(stores.toggleTodo, { id: todoId }, { meta: { caller }, ...input.write });
    return r.ok ? ok({}) : err(r.error);
  },
);
