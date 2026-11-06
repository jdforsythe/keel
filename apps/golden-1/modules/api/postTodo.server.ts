import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "../todos/TodoDraft.schema.ts";
import { addTodo } from "./addTodo.ts";
import { board } from "./board.ts";

type Params = { readonly listId: string };

/** `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id; an unknown list is `keel.notFound`. */
export const postTodo = action(TodoDraft, (input, at: { readonly params: Params }, ctx) => {
  const { listId } = at.params;
  const list = board.get("lists").find((l) => l.id === listId);
  if (list === undefined) return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
  const r = tx(addTodo, { ...input, id: ctx.random.id("Todo"), listId: list.id });
  return r.ok ? ok(null) : err(r.error);
});
