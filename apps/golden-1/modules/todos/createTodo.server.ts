import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/** POST on `todos.list`: send `POST /api/lists/:listId/todos` through the outbox, based on the board as last read. */
export const createTodo = action(todos, "todos.list", { input: TodoDraft }, async (input, { params }, ctx) => {
  const r = await send(ctx, boardOutbox, "addTodo", { params, body: input }, { base: view.get("head"), owner: "" });
  return formAnswer(ctx, "addTodo", r);
});
