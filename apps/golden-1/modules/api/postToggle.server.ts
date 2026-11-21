import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/todos/:todoId/toggle`: flip `done`, with the write's key and base; an unknown todo is `keel.notFound`;
 * a write queued under an owner other than `""` (golden-1 has no sign-in) is `offline.signin`. */
export const postToggle = action(
  api,
  "api.toggleTodo",
  { stores: boardStores },
  (input, { params, caller, stores }) => {
    const { todoId } = params;
    const todo = stores.board.get("todos").find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    const w = writeFor(input.write, "");
    if (!w.ok) return err(w.error);
    const r = tx(stores.toggleTodo, { id: todoId }, { meta: { caller }, ...w.value });
    return r.ok ? ok({}) : err(r.error);
  },
);
