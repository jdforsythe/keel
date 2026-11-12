import { action } from "@keel/router";
import { ok } from "@keel/schema";
import { send } from "@keel/std-offline";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { routes } from "./routes.ts";
import { view } from "./view.ts";

/**
 * POST on `todos.edit`: send `POST /api/todos/:todoId` through the outbox, based on the board as last read. Sent,
 * queued or refused as a conflict (the outbox panel shows it), it goes to the list; the api's 422 `keel.fields`
 * (`{ title }` when another todo in the list has the title) goes to the Form.
 */
export const updateTodo = action({ input: TodoDraft, params: TodoParams }, async (input, { params, url }, ctx) => {
  const origin = new URL(url).origin;
  const call = { params: { todoId: params.todoId }, body: input };
  const r = await send(ctx, boardOutbox, origin, "editTodo", call, { base: view.get("head") });
  const answer = await formAnswer(ctx, "editTodo", r);
  return answer.ok ? ok(routes.href("todos.list", { listId: params.listId })) : answer;
});
