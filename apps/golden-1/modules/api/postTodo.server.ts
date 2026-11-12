import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListParams } from "./ListParams.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id; an unknown list is `keel.notFound`. */
export const postTodo = action(
  { input: TodoDraft, params: ListParams, stores: boardStores },
  (input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    if (!stores.board.get("lists").some((l) => l.id === listId))
      return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
    const r = tx(stores.addTodo, { ...input, id: ctx.random.id("Todo"), listId }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
