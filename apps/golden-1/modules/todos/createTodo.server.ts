import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { ListParams } from "../api/ListParams.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { view } from "./view.ts";

/** POST on `todos.list`: send `POST /api/lists/:listId/todos` through the outbox, based on the board as last read. */
export const createTodo = action({ input: TodoDraft, params: ListParams }, async (input, { params, url }, ctx) => {
  const origin = new URL(url).origin;
  const r = await send(ctx, boardOutbox, origin, "addTodo", { params, body: input }, { base: view.get("head") });
  return formAnswer(ctx, "addTodo", r);
});
