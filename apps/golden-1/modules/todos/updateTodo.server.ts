import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { send } from "@keel/std-offline";
import { tx } from "@keel/store";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorOutcome } from "./editorOutcome.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/**
 * POST on `todos.edit`: send `POST /api/todos/:todoId` through the outbox, based on the board as last read, moving
 * `editorChart` to `saving` and then by the outbox's answer (`editorOutcome`). Sent, queued or refused as a conflict
 * (the outbox panel shows it), it goes to the list; the api's 422 `keel.fields` (`{ title }` when another todo in the
 * list has the title) goes to the Form.
 */
export const updateTodo = action(todos, "todos.edit", { input: TodoDraft }, async (input, { params }, ctx) => {
  const call = { params: { todoId: params.todoId }, body: input };
  const saving = tx(editorChart.events.save, {});
  if (!saving.ok) return err(saving.error);
  const r = await send(ctx, boardOutbox, "editTodo", call, { base: view.get("head"), owner: "" });
  const moved = editorOutcome(r.state);
  if (!moved.ok) return err(moved.error);
  const answer = await formAnswer(ctx, "editTodo", r);
  return answer.ok ? ok(todos.href("todos.list", { listId: params.listId })) : answer;
});
