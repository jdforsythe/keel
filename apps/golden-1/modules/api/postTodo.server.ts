import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListParams } from "../todos/ListParams.schema.ts";
import { TodoDraft } from "../todos/TodoDraft.schema.ts";
import { addTodo } from "./addTodo.ts";
import { board } from "./board.ts";

/** `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id; an unknown list is `keel.notFound`. */
export const postTodo = action({ input: TodoDraft, params: ListParams }, (input, { params }, ctx) => {
  const { listId } = params;
  if (!board.get("lists").some((l) => l.id === listId))
    return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
  const r = tx(addTodo, { ...input, id: ctx.random.id("Todo"), listId });
  return r.ok ? ok(null) : err(r.error);
});
