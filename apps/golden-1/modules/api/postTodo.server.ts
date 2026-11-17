import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListParams } from "./ListParams.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { TodoWrite } from "./TodoWrite.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id, with the write's key and base; an unknown
 * list is `keel.notFound`.
 */
export const postTodo = action(
  { input: TodoWrite, params: ListParams, output: Nothing, stores: boardStores },
  (input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    if (!stores.board.get("lists").some((l) => l.id === listId))
      return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
    const { write, ...draft } = input;
    const r = tx(stores.addTodo, { ...draft, id: ctx.random.id("Todo"), listId }, { meta: { caller }, ...write });
    return r.ok ? ok({}) : err(r.error);
  },
);
